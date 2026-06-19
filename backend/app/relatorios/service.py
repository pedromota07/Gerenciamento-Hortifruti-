from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from ..models import CamadaEstoque, Movimentacao, Produto, SubtipoMovimentacao, TipoMovimentacao


class RelatorioService:
    def __init__(self, session, today_provider=date.today):
        self.session = session
        self.today_provider = today_provider

    def mais_vendidos(self, limite=10, data_inicial=None, data_final=None):
        total_vendido = func.sum(Movimentacao.quantidade)
        receita_total = func.sum(Movimentacao.receita_total)
        lucro_bruto_total = func.sum(Movimentacao.lucro_bruto)

        statement = (
            select(
                Produto.id.label("produto_id"),
                Produto.nome.label("produto_nome"),
                Produto.categoria.label("categoria"),
                Produto.unidade_medida.label("unidade_medida"),
                total_vendido.label("total_vendido"),
                receita_total.label("receita_total"),
                lucro_bruto_total.label("lucro_bruto_total"),
                func.count(Movimentacao.id).label("total_movimentacoes"),
            )
            .join(Produto, Produto.id == Movimentacao.produto_id)
            .where(
                Movimentacao.tipo == TipoMovimentacao.SAIDA,
                Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
            )
            .group_by(
                Produto.id,
                Produto.nome,
                Produto.categoria,
                Produto.unidade_medida,
            )
            .order_by(total_vendido.desc(), Produto.nome.asc())
        )
        statement = self._apply_period_filters(statement, data_inicial, data_final)
        statement = statement.limit(limite)

        rows = self.session.execute(statement).all()

        return [
            {
                "produto_id": produto_id,
                "produto_nome": produto_nome,
                "categoria": categoria.value,
                "unidade_medida": unidade_medida.value,
                "total_vendido": float(total_vendido),
                "receita_total": float(receita_total or 0),
                "lucro_bruto_total": float(lucro_bruto_total or 0),
                "total_movimentacoes": total_movimentacoes,
            }
            for (
                produto_id,
                produto_nome,
                categoria,
                unidade_medida,
                total_vendido,
                receita_total,
                lucro_bruto_total,
                total_movimentacoes,
            ) in rows
        ]

    def financeiro(self, data_inicial=None, data_final=None):
        vendas_statement = select(
            func.coalesce(func.sum(Movimentacao.receita_total), 0),
            func.coalesce(func.sum(Movimentacao.custo_total), 0),
            func.coalesce(func.sum(Movimentacao.lucro_bruto), 0),
        ).where(
            Movimentacao.tipo == TipoMovimentacao.SAIDA,
            Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
        )
        vendas_statement = self._apply_period_filters(vendas_statement, data_inicial, data_final)

        perdas_statement = select(
            func.coalesce(func.sum(Movimentacao.custo_total), 0),
            func.count(Movimentacao.id),
        ).where(
            Movimentacao.tipo == TipoMovimentacao.SAIDA,
            Movimentacao.subtipo == SubtipoMovimentacao.PERDA,
        )
        perdas_statement = self._apply_period_filters(perdas_statement, data_inicial, data_final)

        valor_estoque_custo_stmt = select(
            func.coalesce(func.sum(CamadaEstoque.quantidade_disponivel * CamadaEstoque.custo_unitario), 0)
        ).where(CamadaEstoque.quantidade_disponivel > 0)

        hoje = self.today_provider()
        valor_estoque_venda_stmt = (
            select(func.coalesce(func.sum(CamadaEstoque.quantidade_disponivel * Produto.preco_venda_padrao), 0))
            .join(Produto, Produto.id == CamadaEstoque.produto_id)
            .where(
                CamadaEstoque.quantidade_disponivel > 0,
                CamadaEstoque.data_validade >= hoje,
            )
        )

        receita_total, custo_total_vendas, lucro_bruto_total = self.session.execute(vendas_statement).one()
        perdas_total_custo, perdas_total_registros = self.session.execute(perdas_statement).one()
        valor_estoque_custo = self.session.execute(valor_estoque_custo_stmt).scalar_one()
        valor_estoque_venda = self.session.execute(valor_estoque_venda_stmt).scalar_one()

        return {
            "receita_total": float(receita_total),
            "custo_total_vendas": float(custo_total_vendas),
            "lucro_bruto_total": float(lucro_bruto_total),
            "perdas_total_custo": float(perdas_total_custo),
            "perdas_total_registros": perdas_total_registros,
            "valor_estoque_custo": float(valor_estoque_custo),
            "valor_estoque_venda": float(valor_estoque_venda),
        }

    def validade(self, dias=3):
        hoje = self.today_provider()
        limite = hoje + timedelta(days=dias)

        vencidos_rows = self.session.execute(
            self._build_validade_statement(None, hoje - timedelta(days=1))
        ).all()
        proximos_rows = self.session.execute(
            self._build_validade_statement(hoje, limite)
        ).all()

        vencidos = self._serialize_validade_rows(vencidos_rows)
        proximos_vencimento = self._serialize_validade_rows(proximos_rows)

        return {
            "dias_alerta": dias,
            "vencidos": vencidos,
            "proximos_vencimento": proximos_vencimento,
            "total_vencido_custo": float(sum(item["valor_custo"] for item in vencidos)),
            "total_em_risco_custo": float(sum(item["valor_custo"] for item in proximos_vencimento)),
        }

    def dashboard_inteligente(self, dias_previsao=7, dias_validade=3, data_inicial=None, data_final=None):
        data_inicial, data_final = self._resolver_periodo_dashboard(
            dias_previsao,
            data_inicial,
            data_final,
        )
        dias_periodo = max((data_final - data_inicial).days + 1, 1)

        financeiro = self.financeiro(data_inicial, data_final)
        validade = self.validade(dias_validade)
        mais_vendidos = self._mais_vendidos_dashboard(5, data_inicial, data_final)
        vendas_por_produto = self._vendas_por_produto(data_inicial, data_final)
        analises_produtos = self._analisar_produtos(vendas_por_produto, dias_periodo)

        produtos_parados = self._montar_produtos_parados(analises_produtos)
        alertas = self._montar_alertas_dashboard(analises_produtos, validade, produtos_parados)
        sugestoes_reposicao = self._montar_sugestoes_reposicao(analises_produtos, dias_previsao)
        produtos_criticos = self._montar_produtos_criticos(alertas, analises_produtos)

        receita_total = Decimal(str(financeiro["receita_total"]))
        lucro_bruto_total = Decimal(str(financeiro["lucro_bruto_total"]))
        margem_lucro_percentual = (
            (lucro_bruto_total / receita_total * Decimal("100"))
            if receita_total > Decimal("0")
            else Decimal("0")
        )

        kpis = {
            "receita_total": financeiro["receita_total"],
            "lucro_bruto_total": financeiro["lucro_bruto_total"],
            "margem_lucro_percentual": self._float(margem_lucro_percentual, casas=2),
            "perdas_total_custo": financeiro["perdas_total_custo"],
            "valor_estoque_custo": financeiro["valor_estoque_custo"],
            "valor_estoque_venda": financeiro["valor_estoque_venda"],
            "total_alertas": len(alertas),
            "produtos_vencidos": len(validade["vencidos"]),
            "produtos_proximos_vencimento": len(validade["proximos_vencimento"]),
            "produtos_estoque_baixo": sum(1 for produto in analises_produtos if produto["estoque_baixo"]),
            "produtos_parados": len(produtos_parados),
        }

        return {
            "periodo_analise": {
                "data_inicial": data_inicial.isoformat(),
                "data_final": data_final.isoformat(),
                "dias_periodo": dias_periodo,
                "dias_previsao": dias_previsao,
                "dias_validade": dias_validade,
            },
            "kpis": kpis,
            "alertas": alertas,
            "sugestoes_reposicao": sugestoes_reposicao,
            "produtos_criticos": produtos_criticos,
            "produtos_parados": produtos_parados,
            "mais_vendidos": mais_vendidos,
            "validade": validade,
            "resumo_executivo": self._montar_resumo_executivo(alertas, sugestoes_reposicao, validade, financeiro),
        }

    def _apply_period_filters(self, statement, data_inicial, data_final):
        if data_inicial is not None:
            statement = statement.where(Movimentacao.data >= data_inicial)
        if data_final is not None:
            statement = statement.where(Movimentacao.data <= data_final)
        return statement

    def _resolver_periodo_dashboard(self, dias_previsao, data_inicial, data_final):
        hoje = self.today_provider()

        if data_inicial is None and data_final is None:
            data_final = hoje
            data_inicial = hoje - timedelta(days=dias_previsao - 1)
        elif data_inicial is None:
            data_inicial = data_final - timedelta(days=dias_previsao - 1)
        elif data_final is None:
            data_final = hoje

        return data_inicial, data_final

    def _vendas_por_produto(self, data_inicial, data_final):
        statement = (
            select(
                Movimentacao.produto_id,
                func.coalesce(func.sum(Movimentacao.quantidade), 0),
                func.coalesce(func.sum(Movimentacao.receita_total), 0),
                func.coalesce(func.sum(Movimentacao.lucro_bruto), 0),
                func.count(Movimentacao.id),
            )
            .where(
                Movimentacao.tipo == TipoMovimentacao.SAIDA,
                Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
            )
            .group_by(Movimentacao.produto_id)
        )
        statement = self._apply_period_filters(statement, data_inicial, data_final)

        return {
            produto_id: {
                "quantidade_vendida": Decimal(str(quantidade_vendida or 0)),
                "receita_total": Decimal(str(receita_total or 0)),
                "lucro_bruto_total": Decimal(str(lucro_bruto_total or 0)),
                "total_movimentacoes": total_movimentacoes,
            }
            for produto_id, quantidade_vendida, receita_total, lucro_bruto_total, total_movimentacoes
            in self.session.execute(statement).all()
        }

    def _analisar_produtos(self, vendas_por_produto, dias_periodo):
        hoje = self.today_provider()
        produtos = self.session.execute(
            select(Produto)
            .where(Produto.ativo.is_(True))
            .order_by(Produto.nome.asc(), Produto.id.asc())
        ).scalars()
        analises = []

        for produto in produtos:
            vendas = vendas_por_produto.get(
                produto.id,
                {
                    "quantidade_vendida": Decimal("0"),
                    "receita_total": Decimal("0"),
                    "lucro_bruto_total": Decimal("0"),
                    "total_movimentacoes": 0,
                },
            )
            camadas_abertas = [
                camada
                for camada in produto.camadas_estoque
                if camada.quantidade_disponivel > Decimal("0")
            ]
            estoque_disponivel_venda = sum(
                (
                    camada.quantidade_disponivel
                    for camada in camadas_abertas
                    if camada.data_validade >= hoje
                ),
                Decimal("0"),
            )
            valor_estoque_custo = sum(
                (camada.quantidade_disponivel * camada.custo_unitario for camada in camadas_abertas),
                Decimal("0"),
            )
            media_venda_diaria = vendas["quantidade_vendida"] / Decimal(dias_periodo)
            dias_ate_acabar = (
                estoque_disponivel_venda / media_venda_diaria
                if media_venda_diaria > Decimal("0")
                else None
            )

            analises.append(
                {
                    "produto_id": produto.id,
                    "produto_nome": produto.nome,
                    "categoria": produto.categoria.value,
                    "unidade_medida": produto.unidade_medida.value,
                    "estoque_atual": produto.quantidade_atual,
                    "estoque_minimo": produto.estoque_minimo,
                    "estoque_disponivel_venda": estoque_disponivel_venda,
                    "preco_venda_padrao": produto.preco_venda_padrao,
                    "valor_estoque_custo": valor_estoque_custo,
                    "quantidade_vendida_periodo": vendas["quantidade_vendida"],
                    "receita_total": vendas["receita_total"],
                    "lucro_bruto_total": vendas["lucro_bruto_total"],
                    "total_movimentacoes": vendas["total_movimentacoes"],
                    "media_venda_diaria": media_venda_diaria,
                    "dias_estimados_ate_acabar": dias_ate_acabar,
                    "estoque_baixo": produto.quantidade_atual <= produto.estoque_minimo,
                }
            )

        return analises

    def _montar_alerta(self, prioridade, tipo, produto_id, produto_nome, mensagem, acao_sugerida, extras=None):
        alerta = {
            "prioridade": prioridade,
            "tipo": tipo,
            "produto_id": produto_id,
            "produto_nome": produto_nome,
            "mensagem": mensagem,
            "acao_sugerida": acao_sugerida,
        }
        if extras:
            alerta.update(extras)
        return alerta

    def _mais_vendidos_dashboard(self, limite, data_inicial, data_final):
        ranking = self.mais_vendidos(limite, data_inicial, data_final)

        if len(ranking) >= limite:
            return ranking

        produtos_incluidos = {produto["produto_id"] for produto in ranking}

        for produto in self.mais_vendidos(limite):
            if produto["produto_id"] in produtos_incluidos:
                continue

            ranking.append(produto)
            produtos_incluidos.add(produto["produto_id"])

            if len(ranking) == limite:
                break

        return ranking

    def _montar_alertas_dashboard(self, analises_produtos, validade, produtos_parados):
        alertas = []

        for produto in validade["vencidos"]:
            alertas.append(
                self._montar_alerta(
                    "alta",
                    "produto_vencido",
                    produto["produto_id"],
                    produto["produto_nome"],
                    f"{produto['produto_nome']} possui estoque vencido.",
                    "Registrar perda",
                    {
                        "quantidade": produto["quantidade_total"],
                        "unidade_medida": produto["unidade_medida"],
                    },
                )
            )

        for produto in analises_produtos:
            if produto["estoque_baixo"]:
                alertas.append(
                    self._montar_alerta(
                        "alta",
                        "estoque_baixo",
                        produto["produto_id"],
                        produto["produto_nome"],
                        f"{produto['produto_nome']} está abaixo ou igual ao estoque mínimo.",
                        "Repor estoque",
                        self._serializar_metricas_produto(produto),
                    )
                )

            dias_ate_acabar = produto["dias_estimados_ate_acabar"]
            if dias_ate_acabar is not None:
                if dias_ate_acabar <= Decimal("1"):
                    prioridade = "alta"
                elif dias_ate_acabar <= Decimal("3"):
                    prioridade = "media"
                else:
                    prioridade = None

                if prioridade:
                    alertas.append(
                        self._montar_alerta(
                            prioridade,
                            "risco_ruptura",
                            produto["produto_id"],
                            produto["produto_nome"],
                            f"{produto['produto_nome']} pode acabar em {self._formatar_dias(dias_ate_acabar)}.",
                            "Repor estoque",
                            self._serializar_metricas_produto(produto),
                        )
                    )

        for produto in validade["proximos_vencimento"]:
            alertas.append(
                self._montar_alerta(
                    "media",
                    "proximo_vencimento",
                    produto["produto_id"],
                    produto["produto_nome"],
                    f"{produto['produto_nome']} tem itens próximos do vencimento.",
                    "Fazer promoção",
                    {
                        "quantidade": produto["quantidade_total"],
                        "unidade_medida": produto["unidade_medida"],
                        "proxima_validade": produto["proxima_validade"],
                    },
                )
            )

        for produto in produtos_parados:
            alertas.append(
                self._montar_alerta(
                    "baixa",
                    "produto_parado",
                    produto["produto_id"],
                    produto["produto_nome"],
                    f"{produto['produto_nome']} está sem venda recente e com estoque parado.",
                    "Acompanhar giro",
                    {
                        "estoque_atual": produto["estoque_atual"],
                        "unidade_medida": produto["unidade_medida"],
                        "valor_estoque_custo": produto["valor_estoque_custo"],
                    },
                )
            )

        return sorted(alertas, key=lambda alerta: (self._ordem_prioridade(alerta["prioridade"]), alerta["produto_nome"]))

    def _montar_sugestoes_reposicao(self, analises_produtos, dias_previsao):
        sugestoes = []

        for produto in analises_produtos:
            dias_ate_acabar = produto["dias_estimados_ate_acabar"]
            deve_repor = produto["estoque_baixo"] or (
                dias_ate_acabar is not None and dias_ate_acabar <= Decimal("3")
            )

            if not deve_repor:
                continue

            if produto["estoque_baixo"] or (dias_ate_acabar is not None and dias_ate_acabar <= Decimal("1")):
                prioridade = "alta"
            else:
                prioridade = "media"

            demanda_prevista = produto["media_venda_diaria"] * Decimal(dias_previsao)
            quantidade_sugerida = demanda_prevista + produto["estoque_minimo"] - produto["estoque_disponivel_venda"]

            if quantidade_sugerida <= Decimal("0") and produto["estoque_baixo"]:
                quantidade_sugerida = produto["estoque_minimo"] - produto["estoque_atual"]

            quantidade_sugerida = max(quantidade_sugerida, Decimal("0"))

            sugestoes.append(
                {
                    **self._serializar_metricas_produto(produto),
                    "prioridade": prioridade,
                    "quantidade_sugerida": self._float(quantidade_sugerida),
                    "mensagem": f"Priorizar reposição de {produto['produto_nome']}.",
                    "acao_sugerida": "Repor estoque",
                }
            )

        return sorted(
            sugestoes,
            key=lambda item: (self._ordem_prioridade(item["prioridade"]), item["dias_estimados_ate_acabar"] or 999999),
        )

    def _montar_produtos_parados(self, analises_produtos):
        produtos = [
            {
                **self._serializar_metricas_produto(produto),
                "prioridade": "baixa",
                "mensagem": f"{produto['produto_nome']} não teve venda no período analisado.",
                "acao_sugerida": "Acompanhar giro",
            }
            for produto in analises_produtos
            if produto["estoque_atual"] > Decimal("0")
            and produto["quantidade_vendida_periodo"] == Decimal("0")
        ]

        return sorted(produtos, key=lambda item: item["valor_estoque_custo"], reverse=True)

    def _montar_produtos_criticos(self, alertas, analises_produtos):
        analises_por_id = {produto["produto_id"]: produto for produto in analises_produtos}
        produtos_criticos = []
        produtos_incluidos = set()

        for alerta in alertas:
            if alerta["prioridade"] != "alta" or alerta["produto_id"] in produtos_incluidos:
                continue

            produto = analises_por_id.get(alerta["produto_id"])
            if produto is None:
                produtos_criticos.append(
                    {
                        "produto_id": alerta["produto_id"],
                        "produto_nome": alerta["produto_nome"],
                        "prioridade": "alta",
                        "motivo": alerta["mensagem"],
                        "acao_sugerida": alerta["acao_sugerida"],
                    }
                )
            else:
                produtos_criticos.append(
                    {
                        **self._serializar_metricas_produto(produto),
                        "prioridade": "alta",
                        "motivo": alerta["mensagem"],
                        "acao_sugerida": alerta["acao_sugerida"],
                    }
                )

            produtos_incluidos.add(alerta["produto_id"])

        return produtos_criticos

    def _montar_resumo_executivo(self, alertas, sugestoes_reposicao, validade, financeiro):
        resumo = []
        alertas_alta = [alerta for alerta in alertas if alerta["prioridade"] == "alta"]

        if alertas:
            resumo.append(f"Existem {len(alertas)} alertas que precisam de atenção hoje.")

        if alertas_alta:
            resumo.append(f"{len(alertas_alta)} alertas são críticos e devem ser tratados primeiro.")

        if sugestoes_reposicao:
            produto = sugestoes_reposicao[0]
            resumo.append(f"O produto {produto['produto_nome']} deve ser priorizado na próxima reposição.")

        if financeiro["perdas_total_custo"] > 0:
            resumo.append(f"Há R$ {financeiro['perdas_total_custo']:.2f} em perdas registradas.")

        if validade["proximos_vencimento"]:
            resumo.append("Existem produtos próximos do vencimento que podem virar perda.")

        if not resumo:
            resumo.append("Nenhum alerta crítico encontrado no momento.")

        return resumo

    def _serializar_metricas_produto(self, produto):
        return {
            "produto_id": produto["produto_id"],
            "produto_nome": produto["produto_nome"],
            "categoria": produto["categoria"],
            "unidade_medida": produto["unidade_medida"],
            "estoque_atual": self._float(produto["estoque_atual"]),
            "estoque_minimo": self._float(produto["estoque_minimo"]),
            "estoque_disponivel_venda": self._float(produto["estoque_disponivel_venda"]),
            "quantidade_vendida_periodo": self._float(produto["quantidade_vendida_periodo"]),
            "media_venda_diaria": self._float(produto["media_venda_diaria"]),
            "dias_estimados_ate_acabar": (
                self._float(produto["dias_estimados_ate_acabar"], casas=1)
                if produto["dias_estimados_ate_acabar"] is not None
                else None
            ),
            "valor_estoque_custo": self._float(produto["valor_estoque_custo"], casas=2),
        }

    def _ordem_prioridade(self, prioridade):
        return {"alta": 0, "media": 1, "baixa": 2}.get(prioridade, 3)

    def _float(self, valor, casas=3):
        return round(float(valor or 0), casas)

    def _formatar_dias(self, dias):
        if dias <= Decimal("1"):
            return "até 1 dia"

        return f"{self._float(dias, casas=1)} dias"

    def _build_validade_statement(self, data_minima, data_maxima=None):
        valor_custo = func.sum(CamadaEstoque.quantidade_disponivel * CamadaEstoque.custo_unitario)
        valor_venda = func.sum(CamadaEstoque.quantidade_disponivel * Produto.preco_venda_padrao)

        statement = (
            select(
                Produto.id.label("produto_id"),
                Produto.nome.label("produto_nome"),
                Produto.categoria.label("categoria"),
                Produto.unidade_medida.label("unidade_medida"),
                func.sum(CamadaEstoque.quantidade_disponivel).label("quantidade_total"),
                valor_custo.label("valor_custo"),
                valor_venda.label("valor_venda"),
                func.min(CamadaEstoque.data_validade).label("proxima_validade"),
            )
            .join(Produto, Produto.id == CamadaEstoque.produto_id)
            .where(CamadaEstoque.quantidade_disponivel > 0)
            .group_by(
                Produto.id,
                Produto.nome,
                Produto.categoria,
                Produto.unidade_medida,
            )
            .order_by(func.min(CamadaEstoque.data_validade).asc(), Produto.nome.asc())
        )

        if data_minima is not None:
            statement = statement.where(CamadaEstoque.data_validade >= data_minima)

        if data_maxima is not None:
            statement = statement.where(CamadaEstoque.data_validade <= data_maxima)

        return statement

    def _serialize_validade_rows(self, rows):
        return [
            {
                "produto_id": produto_id,
                "produto_nome": produto_nome,
                "categoria": categoria.value,
                "unidade_medida": unidade_medida.value,
                "quantidade_total": float(quantidade_total),
                "valor_custo": float(valor_custo or 0),
                "valor_venda": float(valor_venda or 0),
                "proxima_validade": proxima_validade.isoformat() if proxima_validade else None,
            }
            for (
                produto_id,
                produto_nome,
                categoria,
                unidade_medida,
                quantidade_total,
                valor_custo,
                valor_venda,
                proxima_validade,
            ) in rows
        ]
