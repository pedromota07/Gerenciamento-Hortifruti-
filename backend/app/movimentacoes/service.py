from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from marshmallow import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..models import (
    CamadaEstoque,
    ConsumoSaida,
    Movimentacao,
    PerfilUsuario,
    Produto,
    SubtipoMovimentacao,
    TipoMovimentacao,
    Usuario,
)
from ..shared.errors import DomainError
from ..shared.money import quantize_money


OPERADOR_PADRAO_EMAIL = "operacao@hortifruti.local"
OPERADOR_PADRAO_NOME = "Operacao Padrao"
OPERADOR_PADRAO_HASH = "auth-nao-configurada"


@dataclass
class MovimentacaoResult:
    movimentacao: Movimentacao
    produto: Produto
    camada_estoque: CamadaEstoque | None = None
    consumos_saida: list[ConsumoSaida] = field(default_factory=list)


class MovimentacaoService:
    def __init__(self, session, today_provider=date.today):
        self.session = session
        self.today_provider = today_provider

    def listar(self, filtros):
        statement = (
            select(
                Movimentacao,
                Produto.nome.label("produto_nome"),
                Usuario.nome.label("usuario_nome"),
            )
            .join(Produto, Produto.id == Movimentacao.produto_id)
            .join(Usuario, Usuario.id == Movimentacao.usuario_id)
            .order_by(Movimentacao.data.desc(), Movimentacao.id.desc())
        )

        if filtros.get("produto_id") is not None:
            statement = statement.where(Movimentacao.produto_id == filtros["produto_id"])

        if filtros.get("tipo") is not None:
            statement = statement.where(Movimentacao.tipo == filtros["tipo"])

        if filtros.get("subtipo") is not None:
            statement = statement.where(Movimentacao.subtipo == filtros["subtipo"])

        if filtros.get("data_inicial") is not None:
            statement = statement.where(Movimentacao.data >= filtros["data_inicial"])

        if filtros.get("data_final") is not None:
            statement = statement.where(Movimentacao.data <= filtros["data_final"])

        if filtros.get("limite") is not None:
            statement = statement.limit(filtros["limite"])

        rows = self.session.execute(statement).all()

        return [
            {
                **movimentacao.to_dict(),
                "produto_nome": produto_nome,
                "usuario_nome": usuario_nome,
            }
            for movimentacao, produto_nome, usuario_nome in rows
        ]

    def registrar_entrada(self, data):
        return self._registrar_movimentacao(
            TipoMovimentacao.ENTRADA,
            data,
            lambda quantidade: quantidade,
        )

    def registrar_saida(self, data):
        return self._registrar_movimentacao(
            TipoMovimentacao.SAIDA,
            data,
            lambda quantidade: -quantidade,
        )

    def _registrar_movimentacao(self, tipo, data, quantidade_delta):
        usuario_id = self._resolve_usuario_id(data.get("usuario_id"))
        data_movimentacao = data.get("data") or self.today_provider()

        try:
            produto = self._get_produto_for_update(data["produto_id"])
            if produto is None:
                self.session.rollback()
                raise DomainError("Produto nao encontrado.", 404)
            if not produto.ativo:
                self.session.rollback()
                raise DomainError("Produto inativo nao pode receber movimentacao.", 409)

            usuario = self.session.get(Usuario, usuario_id)
            if usuario is None:
                self.session.rollback()
                raise DomainError("Usuario nao encontrado.", 404)
            if not usuario.ativo:
                self.session.rollback()
                raise DomainError("Usuario inativo nao pode registrar movimentacao.", 409)

            nova_quantidade = produto.quantidade_atual + quantidade_delta(data["quantidade"])
            if nova_quantidade < Decimal("0"):
                self.session.rollback()
                raise DomainError("Estoque insuficiente para a saida informada.", 409)

            custo_unitario = None
            custo_total = None
            preco_unitario_venda = None
            receita_total = None
            lucro_bruto = None
            subtipo = SubtipoMovimentacao(data["subtipo"]) if data.get("subtipo") else None

            if tipo == TipoMovimentacao.ENTRADA:
                if data.get("custo_unitario") is None or data["custo_unitario"] <= Decimal("0"):
                    self.session.rollback()
                    raise DomainError("Entrada exige custo_unitario maior que zero.", 400)

                custo_unitario = quantize_money(data["custo_unitario"])
                custo_total = quantize_money(data["quantidade"] * custo_unitario)
                subtipo = SubtipoMovimentacao.COMPRA
            else:
                if subtipo is None:
                    self.session.rollback()
                    raise DomainError("Saida exige subtipo informado.", 400)

                incluir_vencidas = subtipo != SubtipoMovimentacao.VENDA
                camadas_saida = self._get_camadas_para_saida(
                    produto.id,
                    data_movimentacao,
                    incluir_vencidas=incluir_vencidas,
                )
                quantidade_disponivel = sum(
                    (camada.quantidade_disponivel for camada in camadas_saida),
                    Decimal("0"),
                )

                if quantidade_disponivel < data["quantidade"]:
                    self.session.rollback()
                    raise DomainError(
                        "Estoque disponivel insuficiente para a saida informada considerando a validade.",
                        409,
                    )

            produto.quantidade_atual = nova_quantidade

            movimentacao = Movimentacao(
                produto_id=produto.id,
                usuario_id=usuario.id,
                tipo=tipo,
                subtipo=subtipo,
                quantidade=data["quantidade"],
                custo_unitario=custo_unitario,
                preco_unitario_venda=preco_unitario_venda,
                receita_total=receita_total,
                custo_total=custo_total,
                lucro_bruto=lucro_bruto,
                data=data_movimentacao,
                observacao=data.get("observacao"),
            )
            self.session.add(movimentacao)
            self.session.flush()

            camada_estoque = None
            consumos_saida = []
            if tipo == TipoMovimentacao.ENTRADA:
                camada_estoque = CamadaEstoque(
                    produto_id=produto.id,
                    movimentacao_entrada_id=movimentacao.id,
                    quantidade_inicial=data["quantidade"],
                    quantidade_disponivel=data["quantidade"],
                    custo_unitario=custo_unitario,
                    data_entrada=data_movimentacao,
                    data_validade=self._build_data_validade(produto, data_movimentacao),
                )
                self.session.add(camada_estoque)
                self.session.flush()
            else:
                quantidade_restante = data["quantidade"]
                custo_total = Decimal("0")

                for camada in camadas_saida:
                    if quantidade_restante <= Decimal("0"):
                        break

                    quantidade_consumida = min(camada.quantidade_disponivel, quantidade_restante)
                    custo_total_consumo = quantize_money(quantidade_consumida * camada.custo_unitario)

                    camada.quantidade_disponivel -= quantidade_consumida
                    quantidade_restante -= quantidade_consumida
                    custo_total += custo_total_consumo

                    consumo = ConsumoSaida(
                        movimentacao_saida_id=movimentacao.id,
                        camada_estoque_id=camada.id,
                        quantidade_consumida=quantidade_consumida,
                        custo_unitario=camada.custo_unitario,
                        custo_total=custo_total_consumo,
                    )
                    self.session.add(consumo)
                    consumos_saida.append(consumo)

                custo_total = quantize_money(custo_total)
                custo_unitario = quantize_money(custo_total / data["quantidade"])

                if subtipo == SubtipoMovimentacao.VENDA:
                    preco_unitario_venda = quantize_money(
                        data["preco_unitario_venda"]
                        if data.get("preco_unitario_venda") is not None
                        else produto.preco_venda_padrao
                    )
                    receita_total = quantize_money(data["quantidade"] * preco_unitario_venda)
                    lucro_bruto = quantize_money(receita_total - custo_total)

                movimentacao.custo_unitario = custo_unitario
                movimentacao.preco_unitario_venda = preco_unitario_venda
                movimentacao.receita_total = receita_total
                movimentacao.custo_total = custo_total
                movimentacao.lucro_bruto = lucro_bruto
                self.session.flush()

            self.session.commit()
        except (DomainError, ValidationError):
            self.session.rollback()
            raise
        except Exception:
            self.session.rollback()
            raise

        return MovimentacaoResult(
            movimentacao=movimentacao,
            produto=produto,
            camada_estoque=camada_estoque,
            consumos_saida=consumos_saida,
        )

    def _get_produto_for_update(self, produto_id):
        statement = (
            select(Produto)
            .where(Produto.id == produto_id)
            .with_for_update()
        )
        return self.session.execute(statement).scalar_one_or_none()

    def _get_or_create_operador_padrao(self):
        usuario = (
            Usuario.query.filter_by(email=OPERADOR_PADRAO_EMAIL)
            .order_by(Usuario.id.asc())
            .first()
        )

        if usuario is not None:
            if not usuario.ativo:
                usuario.ativo = True
                self.session.commit()
            return usuario

        usuario = Usuario(
            nome=OPERADOR_PADRAO_NOME,
            email=OPERADOR_PADRAO_EMAIL,
            senha_hash=OPERADOR_PADRAO_HASH,
            perfil=PerfilUsuario.FUNCIONARIO,
            ativo=True,
        )
        self.session.add(usuario)

        try:
            self.session.commit()
        except IntegrityError:
            self.session.rollback()
            return (
                Usuario.query.filter_by(email=OPERADOR_PADRAO_EMAIL)
                .order_by(Usuario.id.asc())
                .first()
            )

        return usuario

    def _resolve_usuario_id(self, usuario_id):
        if usuario_id is not None:
            return usuario_id

        usuario = self._get_or_create_operador_padrao()
        return usuario.id

    def _build_data_validade(self, produto, data_entrada):
        return data_entrada + timedelta(days=produto.validade_dias_padrao)

    def _get_camadas_para_saida(self, produto_id, data_referencia, incluir_vencidas):
        statement = (
            select(CamadaEstoque)
            .where(
                CamadaEstoque.produto_id == produto_id,
                CamadaEstoque.quantidade_disponivel > Decimal("0"),
            )
            .order_by(
                CamadaEstoque.data_validade.asc(),
                CamadaEstoque.data_entrada.asc(),
                CamadaEstoque.id.asc(),
            )
            .with_for_update()
        )

        if not incluir_vencidas:
            statement = statement.where(CamadaEstoque.data_validade >= data_referencia)

        return list(self.session.execute(statement).scalars())
