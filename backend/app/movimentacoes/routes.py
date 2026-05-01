from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..extensions import db
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
from ..schemas.movimentacao import MovimentacaoCreateSchema

movimentacoes_bp = Blueprint("movimentacoes", __name__)

_movimentacao_create_schema = MovimentacaoCreateSchema()
_OPERADOR_PADRAO_EMAIL = "operacao@hortifruti.local"
_OPERADOR_PADRAO_NOME = "Operacao Padrao"
_OPERADOR_PADRAO_HASH = "auth-nao-configurada"
_MONEY_QUANTUM = Decimal("0.01")


def _json_error(message, status_code):
    return jsonify({"error": message}), status_code


def _parse_optional_positive_int_arg(arg_name):
    raw_value = request.args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        value = int(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Deve ser um inteiro positivo."]})

    if value < 1:
        raise ValidationError({arg_name: ["Deve ser um inteiro positivo."]})

    return value


def _parse_optional_date_arg(arg_name):
    raw_value = request.args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        return date.fromisoformat(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Deve estar no formato YYYY-MM-DD."]})


def _parse_optional_enum_arg(arg_name, enum_class):
    raw_value = request.args.get(arg_name)

    if raw_value in (None, ""):
        return None

    try:
        return enum_class(raw_value)
    except ValueError:
        raise ValidationError({arg_name: ["Valor invalido."]})


def _load_payload():
    payload = request.get_json(silent=True)

    if payload is None:
        raise ValidationError("Payload JSON invalido ou ausente.")

    return _movimentacao_create_schema.load(payload)


def _get_produto_for_update(produto_id):
    statement = (
        select(Produto)
        .where(Produto.id == produto_id)
        .with_for_update()
    )
    return db.session.execute(statement).scalar_one_or_none()


def _get_or_create_operador_padrao():
    usuario = (
        Usuario.query.filter_by(email=_OPERADOR_PADRAO_EMAIL)
        .order_by(Usuario.id.asc())
        .first()
    )

    if usuario is not None:
        if not usuario.ativo:
            usuario.ativo = True
            db.session.commit()
        return usuario

    usuario = Usuario(
        nome=_OPERADOR_PADRAO_NOME,
        email=_OPERADOR_PADRAO_EMAIL,
        senha_hash=_OPERADOR_PADRAO_HASH,
        perfil=PerfilUsuario.FUNCIONARIO,
        ativo=True,
    )
    db.session.add(usuario)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return (
            Usuario.query.filter_by(email=_OPERADOR_PADRAO_EMAIL)
            .order_by(Usuario.id.asc())
            .first()
        )

    return usuario


def _resolve_usuario_id(usuario_id):
    if usuario_id is not None:
        return usuario_id

    usuario = _get_or_create_operador_padrao()
    return usuario.id


def _quantize_money(value):
    return value.quantize(_MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def _build_data_validade(produto, data_entrada):
    return data_entrada + timedelta(days=produto.validade_dias_padrao)


def _get_camadas_para_saida(produto_id, data_referencia, incluir_vencidas):
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

    return list(db.session.execute(statement).scalars())


def _registrar_movimentacao(tipo, quantidade_delta):
    try:
        data = _load_payload()
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

    usuario_id = _resolve_usuario_id(data.get("usuario_id"))
    data_movimentacao = data.get("data") or date.today()

    try:
        produto = _get_produto_for_update(data["produto_id"])
        if produto is None:
            db.session.rollback()
            return _json_error("Produto nao encontrado.", 404)
        if not produto.ativo:
            db.session.rollback()
            return _json_error("Produto inativo nao pode receber movimentacao.", 409)

        usuario = db.session.get(Usuario, usuario_id)
        if usuario is None:
            db.session.rollback()
            return _json_error("Usuario nao encontrado.", 404)
        if not usuario.ativo:
            db.session.rollback()
            return _json_error("Usuario inativo nao pode registrar movimentacao.", 409)

        nova_quantidade = produto.quantidade_atual + quantidade_delta(data["quantidade"])
        if nova_quantidade < Decimal("0"):
            db.session.rollback()
            return _json_error("Estoque insuficiente para a saida informada.", 409)

        custo_unitario = None
        custo_total = None
        preco_unitario_venda = None
        receita_total = None
        lucro_bruto = None
        subtipo = SubtipoMovimentacao(data["subtipo"]) if data.get("subtipo") else None

        if tipo == TipoMovimentacao.ENTRADA:
            if data.get("custo_unitario") is None or data["custo_unitario"] <= Decimal("0"):
                db.session.rollback()
                return _json_error("Entrada exige custo_unitario maior que zero.", 400)

            custo_unitario = _quantize_money(data["custo_unitario"])
            custo_total = _quantize_money(data["quantidade"] * custo_unitario)
            subtipo = SubtipoMovimentacao.COMPRA
        else:
            if subtipo is None:
                db.session.rollback()
                return _json_error("Saida exige subtipo informado.", 400)

            incluir_vencidas = subtipo != SubtipoMovimentacao.VENDA
            camadas_saida = _get_camadas_para_saida(
                produto.id,
                data_movimentacao,
                incluir_vencidas=incluir_vencidas,
            )
            quantidade_disponivel = sum(
                (camada.quantidade_disponivel for camada in camadas_saida),
                Decimal("0"),
            )

            if quantidade_disponivel < data["quantidade"]:
                db.session.rollback()
                return _json_error(
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
        db.session.add(movimentacao)
        db.session.flush()

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
                data_validade=_build_data_validade(produto, data_movimentacao),
            )
            db.session.add(camada_estoque)
            db.session.flush()
        else:
            quantidade_restante = data["quantidade"]
            custo_total = Decimal("0")

            for camada in camadas_saida:
                if quantidade_restante <= Decimal("0"):
                    break

                quantidade_consumida = min(camada.quantidade_disponivel, quantidade_restante)
                custo_total_consumo = _quantize_money(quantidade_consumida * camada.custo_unitario)

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
                db.session.add(consumo)
                consumos_saida.append(consumo)

            custo_total = _quantize_money(custo_total)
            custo_unitario = _quantize_money(custo_total / data["quantidade"])

            if subtipo == SubtipoMovimentacao.VENDA:
                preco_unitario_venda = _quantize_money(
                    data["preco_unitario_venda"]
                    if data.get("preco_unitario_venda") is not None
                    else produto.preco_venda_padrao
                )
                receita_total = _quantize_money(data["quantidade"] * preco_unitario_venda)
                lucro_bruto = _quantize_money(receita_total - custo_total)

            movimentacao.custo_unitario = custo_unitario
            movimentacao.preco_unitario_venda = preco_unitario_venda
            movimentacao.receita_total = receita_total
            movimentacao.custo_total = custo_total
            movimentacao.lucro_bruto = lucro_bruto
            db.session.flush()

        db.session.commit()

        response_payload = {
            "movimentacao": movimentacao.to_dict(),
            "produto": produto.to_dict(),
        }
        if camada_estoque is not None:
            response_payload["camada_estoque"] = camada_estoque.to_dict()
        if consumos_saida:
            response_payload["consumos_saida"] = [consumo.to_dict() for consumo in consumos_saida]
    except ValidationError as exc:
        db.session.rollback()
        return _json_error(exc.messages, 400)
    except Exception:
        db.session.rollback()
        raise

    return jsonify(response_payload), 201


@movimentacoes_bp.get("")
def list_movimentacoes():
    try:
        produto_id = _parse_optional_positive_int_arg("produto_id")
        limite = _parse_optional_positive_int_arg("limite")
        tipo = _parse_optional_enum_arg("tipo", TipoMovimentacao)
        subtipo = _parse_optional_enum_arg("subtipo", SubtipoMovimentacao)
        data_inicial = _parse_optional_date_arg("data_inicial")
        data_final = _parse_optional_date_arg("data_final")
    except ValidationError as exc:
        return _json_error(exc.messages, 400)

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

    if produto_id is not None:
        statement = statement.where(Movimentacao.produto_id == produto_id)

    if tipo is not None:
        statement = statement.where(Movimentacao.tipo == tipo)

    if subtipo is not None:
        statement = statement.where(Movimentacao.subtipo == subtipo)

    if data_inicial is not None:
        statement = statement.where(Movimentacao.data >= data_inicial)

    if data_final is not None:
        statement = statement.where(Movimentacao.data <= data_final)

    if limite is not None:
        statement = statement.limit(limite)

    rows = db.session.execute(statement).all()

    return (
        jsonify(
            [
                {
                    **movimentacao.to_dict(),
                    "produto_nome": produto_nome,
                    "usuario_nome": usuario_nome,
                }
                for movimentacao, produto_nome, usuario_nome in rows
            ]
        ),
        200,
    )


@movimentacoes_bp.post("/entrada")
def create_entrada():
    return _registrar_movimentacao(
        TipoMovimentacao.ENTRADA,
        lambda quantidade: quantidade,
    )


@movimentacoes_bp.post("/saida")
def create_saida():
    return _registrar_movimentacao(
        TipoMovimentacao.SAIDA,
        lambda quantidade: -quantidade,
    )
