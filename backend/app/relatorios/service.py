from collections import Counter
from datetime import date, timedelta
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP

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

    def dashboard_inteligente(
        self,
        dias_previsao=7,
        dias_validade=3,
        limite=10,
        data_inicial=None,
        data_final=None,
    ):
        return DashboardInteligenteService(self.session, self.today_provider).gerar(
            dias_previsao=dias_previsao,
            dias_validade=dias_validade,
            limite=limite,
            data_inicial=data_inicial,
            data_final=data_final,
        )

    def _apply_period_filters(self, statement, data_inicial, data_final):
        if data_inicial is not None:
            statement = statement.where(Movimentacao.data >= data_inicial)
        if data_final is not None:
            statement = statement.where(Movimentacao.data <= data_final)
        return statement

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


class DashboardInteligenteService:
    PRIORIDADE_ORDEM = {"critica": 0, "alta": 1, "media": 2, "baixa": 3}
    MARGEM_BAIXA_PERCENTUAL = Decimal("20")
    BASE_MINIMA_PERCENTUAL_MONETARIO = Decimal("10")
    VARIACAO_PERCENTUAL_MAXIMA_EXIBICAO = Decimal("999")

    def __init__(self, session, today_provider=date.today):
        self.session = session
        self.today_provider = today_provider

    def gerar(self, dias_previsao=7, dias_validade=3, limite=10, data_inicial=None, data_final=None):
        hoje = self.today_provider()
        data_inicial, data_final = self._resolver_periodo(data_inicial, data_final, hoje)
        dias_periodo = max((data_final - data_inicial).days + 1, 1)

        relatorios = RelatorioService(self.session, self.today_provider)
        financeiro = relatorios.financeiro(data_inicial, data_final)
        mais_vendidos = relatorios.mais_vendidos(limite, data_inicial, data_final)
        vendas_por_produto = self._vendas_por_produto(data_inicial, data_final)
        ultimas_vendas = self._ultimas_vendas_por_produto()
        analises_produtos = self._analisar_produtos(vendas_por_produto, ultimas_vendas, dias_periodo, hoje)
        risco_validade_completo = self._analisar_validade(dias_validade, None, hoje)
        risco_validade = self._limitar_risco_validade(risco_validade_completo, limite)
        produtos_parados_completos = self._montar_produtos_parados(analises_produtos, None)
        produtos_parados = produtos_parados_completos[:limite]
        analise_margem_completa = self._montar_analise_margem(analises_produtos, None)
        analise_margem = analise_margem_completa[:limite]
        analise_perdas_completa, perdas_por_tipo = self._montar_analise_perdas(data_inicial, data_final, None)
        analise_perdas = analise_perdas_completa[:limite]
        receita_total = self._decimal(financeiro["receita_total"])
        lucro_bruto_total = self._decimal(financeiro["lucro_bruto_total"])
        perdas_total_custo = self._decimal(financeiro["perdas_total_custo"])
        margem_geral = self._percentual(lucro_bruto_total, receita_total)
        comparativo_periodo = self._montar_comparativo_periodo(
            relatorios,
            data_inicial,
            dias_periodo,
            receita_total,
            lucro_bruto_total,
            perdas_total_custo,
            margem_geral,
        )
        perdas_relevantes = perdas_total_custo > Decimal("0") and (
            lucro_bruto_total <= Decimal("0")
            or perdas_total_custo / lucro_bruto_total >= Decimal("0.15")
        )
        sugestoes_reposicao_completas = self._montar_sugestoes_reposicao(analises_produtos, dias_previsao, None)
        sugestoes_reposicao = sugestoes_reposicao_completas if limite is None else sugestoes_reposicao_completas[:limite]
        prioridades = self._montar_prioridades(
            analises_produtos,
            risco_validade_completo,
            produtos_parados_completos,
            analise_margem_completa,
            analise_perdas_completa,
            perdas_relevantes,
        )

        alertas_criticos = sum(1 for prioridade in prioridades if prioridade["prioridade"] == "critica")
        saude_operacional = self._calcular_saude_operacional(
            prioridades,
            risco_validade_completo,
            analises_produtos,
            produtos_parados_completos,
            perdas_total_custo,
            lucro_bruto_total,
            margem_geral,
            sugestoes_reposicao_completas,
        )

        kpis = {
            "receita_total": self._float(receita_total, 2),
            "lucro_bruto_total": self._float(lucro_bruto_total, 2),
            "margem_lucro_percentual": self._float(margem_geral, 2),
            "valor_estoque_custo": financeiro["valor_estoque_custo"],
            "valor_estoque_venda": financeiro["valor_estoque_venda"],
            "perdas_total_custo": self._float(perdas_total_custo, 2),
            "alertas_total": len(prioridades),
            "alertas_criticos": alertas_criticos,
            "produtos_vencidos": len(risco_validade_completo["vencidos"]),
            "produtos_proximos_vencimento": len(risco_validade_completo["proximos_vencimento"]),
            "produtos_estoque_baixo": sum(1 for produto in analises_produtos if produto["estoque_baixo"]),
            "produtos_parados": len(produtos_parados_completos),
            "total_alertas": len(prioridades),
        }

        return {
            "periodo_analise": {
                "data_inicial": data_inicial.isoformat(),
                "data_final": data_final.isoformat(),
                "dias_periodo": dias_periodo,
                "dias_previsao": dias_previsao,
                "dias_validade": dias_validade,
            },
            "saude_operacional": saude_operacional,
            "kpis": kpis,
            "comparativo_periodo": comparativo_periodo,
            "resumo_executivo": self._montar_resumo_executivo(
                prioridades,
                sugestoes_reposicao,
                risco_validade_completo,
                analise_margem_completa,
                analise_perdas_completa,
                saude_operacional,
            ),
            "prioridades_hoje": self._limitar_prioridades(prioridades),
            "sugestoes_reposicao": sugestoes_reposicao,
            "risco_validade": risco_validade,
            "produtos_parados": produtos_parados,
            "analise_margem": analise_margem,
            "analise_perdas": analise_perdas,
            "mais_vendidos": mais_vendidos,
            "series_graficos": {
                "vendas_por_dia": self._serie_vendas_por_dia(data_inicial, data_final),
                "perdas_por_tipo": perdas_por_tipo,
                "top_produtos": [
                    {
                        "produto_id": item["produto_id"],
                        "produto_nome": item["produto_nome"],
                        "total_vendido": item["total_vendido"],
                        "receita_total": item["receita_total"],
                    }
                    for item in mais_vendidos
                ],
                "alertas_por_tipo": self._alertas_por_tipo(prioridades),
            },
        }

    def _resolver_periodo(self, data_inicial, data_final, hoje):
        if data_inicial is None and data_final is None:
            data_final = hoje
            data_inicial = hoje - timedelta(days=29)
        elif data_inicial is None:
            data_inicial = data_final - timedelta(days=29)
        elif data_final is None:
            data_final = hoje

        return data_inicial, data_final

    def _montar_comparativo_periodo(
        self,
        relatorios,
        data_inicial,
        dias_periodo,
        receita_total,
        lucro_bruto_total,
        perdas_total_custo,
        margem_geral,
    ):
        data_final_anterior = data_inicial - timedelta(days=1)
        data_inicial_anterior = data_final_anterior - timedelta(days=dias_periodo - 1)
        financeiro_anterior = relatorios.financeiro(data_inicial_anterior, data_final_anterior)
        receita_anterior = self._decimal(financeiro_anterior["receita_total"])
        lucro_anterior = self._decimal(financeiro_anterior["lucro_bruto_total"])
        perdas_anterior = self._decimal(financeiro_anterior["perdas_total_custo"])
        margem_anterior = self._percentual(lucro_anterior, receita_anterior)

        return {
            "periodo_anterior": {
                "data_inicial": data_inicial_anterior.isoformat(),
                "data_final": data_final_anterior.isoformat(),
                "dias_periodo": dias_periodo,
            },
            "indicadores": {
                "receita_total": self._comparar_valor_historico(receita_total, receita_anterior, maior_melhor=True),
                "lucro_bruto_total": self._comparar_valor_historico(lucro_bruto_total, lucro_anterior, maior_melhor=True),
                "margem_lucro_percentual": self._comparar_margem_historica(margem_geral, margem_anterior),
                "perdas_total_custo": self._comparar_valor_historico(perdas_total_custo, perdas_anterior, maior_melhor=False),
            },
        }

    def _comparar_valor_historico(self, atual, anterior, maior_melhor):
        atual = self._decimal(atual)
        anterior = self._decimal(anterior)
        variacao = atual - anterior
        variacao_percentual = None if anterior == Decimal("0") else variacao / anterior * Decimal("100")
        base_relevante = (
            anterior >= self.BASE_MINIMA_PERCENTUAL_MONETARIO
            and (
                variacao_percentual is None
                or abs(variacao_percentual) <= self.VARIACAO_PERCENTUAL_MAXIMA_EXIBICAO
            )
        )

        return {
            "atual": self._float(atual, 2),
            "anterior": self._float(anterior, 2),
            "variacao_absoluta": self._float(variacao, 2),
            "variacao_percentual": self._float(variacao_percentual, 2) if base_relevante else None,
            "base_relevante": base_relevante,
            "impacto": self._classificar_impacto_variacao(variacao, maior_melhor),
        }

    def _comparar_margem_historica(self, atual, anterior):
        atual = self._decimal(atual)
        anterior = self._decimal(anterior)
        variacao = atual - anterior

        return {
            "atual": self._float(atual, 2),
            "anterior": self._float(anterior, 2),
            "variacao_pontos_percentuais": self._float(variacao, 2),
            "impacto": self._classificar_impacto_variacao(variacao, maior_melhor=True),
        }

    def _classificar_impacto_variacao(self, variacao, maior_melhor):
        variacao = self._decimal(variacao)
        if variacao == Decimal("0"):
            return "neutro"

        melhorou = variacao > Decimal("0") if maior_melhor else variacao < Decimal("0")
        return "positivo" if melhorou else "negativo"

    def _vendas_por_produto(self, data_inicial, data_final):
        statement = (
            select(
                Movimentacao.produto_id,
                func.coalesce(func.sum(Movimentacao.quantidade), 0),
                func.coalesce(func.sum(Movimentacao.receita_total), 0),
                func.coalesce(func.sum(Movimentacao.custo_total), 0),
                func.coalesce(func.sum(Movimentacao.lucro_bruto), 0),
                func.count(Movimentacao.id),
                func.max(Movimentacao.data),
            )
            .where(
                Movimentacao.tipo == TipoMovimentacao.SAIDA,
                Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
                Movimentacao.data >= data_inicial,
                Movimentacao.data <= data_final,
            )
            .group_by(Movimentacao.produto_id)
        )

        return {
            produto_id: {
                "quantidade_vendida": self._decimal(quantidade_vendida),
                "receita_total": self._decimal(receita_total),
                "custo_total": self._decimal(custo_total),
                "lucro_bruto_total": self._decimal(lucro_bruto_total),
                "total_movimentacoes": total_movimentacoes,
                "ultima_venda_periodo": ultima_venda,
            }
            for (
                produto_id,
                quantidade_vendida,
                receita_total,
                custo_total,
                lucro_bruto_total,
                total_movimentacoes,
                ultima_venda,
            ) in self.session.execute(statement).all()
        }

    def _ultimas_vendas_por_produto(self):
        rows = self.session.execute(
            select(Movimentacao.produto_id, func.max(Movimentacao.data))
            .where(
                Movimentacao.tipo == TipoMovimentacao.SAIDA,
                Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
            )
            .group_by(Movimentacao.produto_id)
        ).all()
        return {produto_id: ultima_data for produto_id, ultima_data in rows}

    def _analisar_produtos(self, vendas_por_produto, ultimas_vendas, dias_periodo, hoje):
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
                    "custo_total": Decimal("0"),
                    "lucro_bruto_total": Decimal("0"),
                    "total_movimentacoes": 0,
                    "ultima_venda_periodo": None,
                },
            )
            camadas_abertas = [
                camada
                for camada in produto.camadas_estoque
                if camada.quantidade_disponivel > Decimal("0")
            ]
            estoque_vendavel = sum(
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
            primeira_entrada_aberta = min((camada.data_entrada for camada in camadas_abertas), default=None)
            media_venda_diaria = vendas["quantidade_vendida"] / Decimal(dias_periodo)
            dias_cobertura = (
                estoque_vendavel / media_venda_diaria
                if media_venda_diaria > Decimal("0")
                else None
            )
            ultima_venda = ultimas_vendas.get(produto.id)
            dias_sem_venda = (hoje - ultima_venda).days if ultima_venda else None
            margem_percentual = self._percentual(vendas["lucro_bruto_total"], vendas["receita_total"])

            analises.append(
                {
                    "produto_id": produto.id,
                    "produto_nome": produto.nome,
                    "categoria": produto.categoria.value,
                    "unidade_medida": produto.unidade_medida.value,
                    "estoque_atual": produto.quantidade_atual,
                    "estoque_minimo": produto.estoque_minimo,
                    "estoque_disponivel_venda": estoque_vendavel,
                    "valor_estoque_custo": valor_estoque_custo,
                    "quantidade_vendida_periodo": vendas["quantidade_vendida"],
                    "receita_total": vendas["receita_total"],
                    "custo_total": vendas["custo_total"],
                    "lucro_bruto_total": vendas["lucro_bruto_total"],
                    "margem_percentual": margem_percentual,
                    "total_movimentacoes": vendas["total_movimentacoes"],
                    "media_venda_diaria": media_venda_diaria,
                    "dias_cobertura": dias_cobertura,
                    "estoque_baixo": estoque_vendavel <= produto.estoque_minimo,
                    "ultima_venda": ultima_venda,
                    "dias_sem_venda": dias_sem_venda,
                    "primeira_entrada_aberta": primeira_entrada_aberta,
                }
            )

        return analises

    def _analisar_validade(self, dias_validade, limite, hoje):
        limite_validade = hoje + timedelta(days=dias_validade)
        agrupados = {}
        rows = self.session.execute(
            select(CamadaEstoque, Produto)
            .join(Produto, Produto.id == CamadaEstoque.produto_id)
            .where(
                Produto.ativo.is_(True),
                CamadaEstoque.quantidade_disponivel > Decimal("0"),
                CamadaEstoque.data_validade <= limite_validade,
            )
            .order_by(CamadaEstoque.data_validade.asc(), Produto.nome.asc())
        ).all()

        for camada, produto in rows:
            chave = (
                "vencidos"
                if camada.data_validade < hoje
                else "proximos_vencimento"
            )
            item = agrupados.setdefault(
                (chave, produto.id),
                {
                    "produto_id": produto.id,
                    "produto_nome": produto.nome,
                    "categoria": produto.categoria.value,
                    "unidade_medida": produto.unidade_medida.value,
                    "quantidade_em_risco": Decimal("0"),
                    "valor_em_risco": Decimal("0"),
                    "data_validade": camada.data_validade,
                },
            )
            item["quantidade_em_risco"] += camada.quantidade_disponivel
            item["valor_em_risco"] += camada.quantidade_disponivel * camada.custo_unitario
            item["data_validade"] = min(item["data_validade"], camada.data_validade)

        vencidos = []
        proximos = []
        for (grupo, _produto_id), item in agrupados.items():
            dias_para_vencer = (item["data_validade"] - hoje).days
            quantidade = item["quantidade_em_risco"]
            valor = item["valor_em_risco"]
            custo_unitario = valor / quantidade if quantidade > Decimal("0") else Decimal("0")
            serializado = {
                **{key: item[key] for key in ("produto_id", "produto_nome", "categoria", "unidade_medida")},
                "quantidade_em_risco": self._float(quantidade),
                "quantidade_total": self._float(quantidade),
                "custo_unitario_medio": self._float(custo_unitario, 2),
                "valor_em_risco": self._float(valor, 2),
                "valor_custo": self._float(valor, 2),
                "dias_para_vencer": dias_para_vencer,
                "data_validade": item["data_validade"].isoformat(),
                "proxima_validade": item["data_validade"].isoformat(),
                "acao_sugerida": self._acao_validade(dias_para_vencer),
            }
            if grupo == "vencidos":
                vencidos.append(serializado)
            else:
                proximos.append(serializado)

        vencidos.sort(key=lambda item: (-item["valor_em_risco"], item["produto_nome"]))
        proximos.sort(key=lambda item: (item["dias_para_vencer"], -item["valor_em_risco"], item["produto_nome"]))
        valor_total = sum(item["valor_em_risco"] for item in vencidos + proximos)

        return {
            "vencidos": vencidos if limite is None else vencidos[:limite],
            "proximos_vencimento": proximos if limite is None else proximos[:limite],
            "valor_em_risco": self._float(valor_total, 2),
            "acao_geral_sugerida": (
                "Retirar vencidos imediatamente e priorizar promoção dos itens próximos."
                if valor_total > 0
                else "Sem ação emergencial de validade no momento."
            ),
        }

    def _limitar_risco_validade(self, risco_validade, limite):
        return {
            **risco_validade,
            "vencidos": risco_validade["vencidos"][:limite],
            "proximos_vencimento": risco_validade["proximos_vencimento"][:limite],
        }

    def _montar_produtos_parados(self, analises_produtos, limite):
        produtos = []
        for produto in analises_produtos:
            if produto["estoque_disponivel_venda"] <= Decimal("0"):
                continue

            sem_venda_recente = (
                produto["dias_sem_venda"] is None
                or produto["dias_sem_venda"] >= 30
            )
            estoque_antigo = (
                produto["primeira_entrada_aberta"] is None
                or (self.today_provider() - produto["primeira_entrada_aberta"]).days >= 15
            )
            baixo_giro = (
                produto["media_venda_diaria"] > Decimal("0")
                and produto["dias_cobertura"] is not None
                and produto["dias_cobertura"] >= Decimal("30")
            )

            if not ((sem_venda_recente and estoque_antigo) or baixo_giro):
                continue

            acao = "Fazer promoção" if produto["valor_estoque_custo"] > Decimal("50") else "Reposicionar exposição"
            produtos.append(
                {
                    **self._metricas_produto(produto),
                    "valor_parado_custo": self._float(produto["valor_estoque_custo"], 2),
                    "dias_sem_venda": produto["dias_sem_venda"],
                    "prioridade": "baixa",
                    "acao_sugerida": acao,
                    "mensagem": f"{produto['produto_nome']} está com estoque e sem giro recente.",
                }
            )

        produtos = sorted(produtos, key=lambda item: item["valor_parado_custo"], reverse=True)
        return produtos if limite is None else produtos[:limite]

    def _montar_analise_margem(self, analises_produtos, limite):
        analises = []
        for produto in analises_produtos:
            if produto["quantidade_vendida_periodo"] <= Decimal("0"):
                continue

            margem = produto["margem_percentual"]
            if margem < Decimal("10"):
                classificacao = "critica"
                prioridade = "alta"
                acao = "Revisar preço de venda e custo de compra"
            elif margem < Decimal("20"):
                classificacao = "baixa"
                prioridade = "media"
                acao = "Renegociar custo de compra"
            elif margem < Decimal("35"):
                classificacao = "saudavel"
                prioridade = "baixa"
                acao = "Acompanhar margem"
            else:
                classificacao = "boa"
                prioridade = "baixa"
                acao = "Manter estratégia comercial"

            analises.append(
                {
                    "produto_id": produto["produto_id"],
                    "produto_nome": produto["produto_nome"],
                    "categoria": produto["categoria"],
                    "unidade_medida": produto["unidade_medida"],
                    "receita_total": self._float(produto["receita_total"], 2),
                    "custo_total": self._float(produto["custo_total"], 2),
                    "lucro_bruto_total": self._float(produto["lucro_bruto_total"], 2),
                    "margem_percentual": self._float(margem, 2),
                    "classificacao": classificacao,
                    "prioridade": prioridade,
                    "acao_sugerida": acao,
                }
            )

        analises = sorted(analises, key=lambda item: (item["margem_percentual"], -item["receita_total"]))
        return analises if limite is None else analises[:limite]

    def _montar_analise_perdas(self, data_inicial, data_final, limite):
        rows = self.session.execute(
            select(Movimentacao, Produto)
            .join(Produto, Produto.id == Movimentacao.produto_id)
            .where(
                Movimentacao.tipo == TipoMovimentacao.SAIDA,
                Movimentacao.subtipo == SubtipoMovimentacao.PERDA,
                Movimentacao.data >= data_inicial,
                Movimentacao.data <= data_final,
            )
            .order_by(Movimentacao.data.desc(), Movimentacao.id.desc())
        ).all()
        por_produto = {}
        por_tipo = Counter()
        custo_por_tipo = Counter()

        for movimentacao, produto in rows:
            tipo_perda = self._classificar_perda(movimentacao.observacao)
            custo = self._decimal(movimentacao.custo_total)
            por_tipo[tipo_perda] += 1
            custo_por_tipo[tipo_perda] += float(custo)
            item = por_produto.setdefault(
                produto.id,
                {
                    "produto_id": produto.id,
                    "produto_nome": produto.nome,
                    "categoria": produto.categoria.value,
                    "unidade_medida": produto.unidade_medida.value,
                    "quantidade_total": Decimal("0"),
                    "custo_total": Decimal("0"),
                    "total_registros": 0,
                    "tipos": Counter(),
                    "acao_sugerida": "Melhorar controle de validade",
                },
            )
            item["quantidade_total"] += movimentacao.quantidade
            item["custo_total"] += custo
            item["total_registros"] += 1
            item["tipos"][tipo_perda] += 1
            if tipo_perda == "avaria":
                item["acao_sugerida"] = "Melhorar manuseio e conferência de recebimento"
            elif tipo_perda == "vencimento":
                item["acao_sugerida"] = "Aumentar giro com promoção e reduzir compra"

        analise = [
            {
                **{key: item[key] for key in ("produto_id", "produto_nome", "categoria", "unidade_medida")},
                "quantidade_total": self._float(item["quantidade_total"]),
                "custo_total": self._float(item["custo_total"], 2),
                "total_registros": item["total_registros"],
                "principal_tipo": item["tipos"].most_common(1)[0][0],
                "acao_sugerida": item["acao_sugerida"],
            }
            for item in por_produto.values()
        ]
        analise.sort(key=lambda item: item["custo_total"], reverse=True)
        perdas_por_tipo = [
            {
                "tipo": tipo,
                "total_registros": por_tipo[tipo],
                "custo_total": round(custo_por_tipo[tipo], 2),
            }
            for tipo in sorted(por_tipo)
        ]
        return (analise if limite is None else analise[:limite]), perdas_por_tipo

    def _montar_sugestoes_reposicao(self, analises_produtos, dias_previsao, limite):
        sugestoes = []
        for produto in analises_produtos:
            media = produto["media_venda_diaria"]
            if media <= Decimal("0"):
                continue

            dias_cobertura = produto["dias_cobertura"]
            if not produto["estoque_baixo"] and (dias_cobertura is None or dias_cobertura > Decimal("7")):
                continue

            if dias_cobertura is not None and dias_cobertura <= Decimal("1"):
                prioridade = "critica"
            elif dias_cobertura is not None and dias_cobertura <= Decimal("3"):
                prioridade = "alta"
            elif dias_cobertura is not None and dias_cobertura <= Decimal("7"):
                prioridade = "media"
            else:
                prioridade = "alta"

            quantidade_sugerida = (
                media * Decimal(dias_previsao)
                + produto["estoque_minimo"]
                - produto["estoque_disponivel_venda"]
            )
            quantidade_sugerida = max(quantidade_sugerida, Decimal("0"))
            quantidade_sugerida = self._arredondar_quantidade(quantidade_sugerida, produto["unidade_medida"])
            cobertura_texto = self._formatar_dias(dias_cobertura) if dias_cobertura is not None else "sem cobertura calculada"
            casas_quantidade = self._casas_quantidade_reposicao(produto["unidade_medida"])
            quantidade_texto = self._formatar_quantidade_reposicao(quantidade_sugerida, produto["unidade_medida"])
            sugestoes.append(
                {
                    **self._metricas_produto(produto),
                    "venda_total_periodo": self._float(produto["quantidade_vendida_periodo"]),
                    "media_venda_diaria": self._float(media),
                    "dias_cobertura": self._float(dias_cobertura, 1) if dias_cobertura is not None else None,
                    "quantidade_sugerida": self._float(quantidade_sugerida, casas_quantidade),
                    "prioridade": prioridade,
                    "justificativa": (
                        f"Comprar aproximadamente {quantidade_texto} de {produto['produto_nome']} para cobrir "
                        f"{dias_previsao} dias de venda média; cobertura atual: {cobertura_texto}."
                    ),
                }
            )

        sugestoes.sort(
            key=lambda item: (
                self.PRIORIDADE_ORDEM[item["prioridade"]],
                item["dias_cobertura"] if item["dias_cobertura"] is not None else 999999,
                -item["quantidade_sugerida"],
            )
        )
        return sugestoes[:limite]

    def _montar_prioridades(
        self,
        analises_produtos,
        risco_validade,
        produtos_parados,
        analise_margem,
        analise_perdas,
        perdas_relevantes,
    ):
        prioridades = []
        analises_por_id = {produto["produto_id"]: produto for produto in analises_produtos}

        for item in risco_validade["vencidos"]:
            prioridades.append(
                self._prioridade(
                    "validade_vencida",
                    "critica",
                    100,
                    item["produto_id"],
                    item["produto_nome"],
                    f"{item['produto_nome']} possui estoque vencido disponível.",
                    f"Há {item['quantidade_em_risco']} {item['unidade_medida']} vencidos desde {item['data_validade']}.",
                    "Registrar perda ou retirar do estoque imediatamente",
                    f"R$ {item['valor_em_risco']:.2f} em custo vencido.",
                    {"quantidade_em_risco": item["quantidade_em_risco"], "valor_em_risco": item["valor_em_risco"]},
                    item["valor_em_risco"],
                    data_validade=item["data_validade"],
                )
            )

        for produto in analises_produtos:
            dias_cobertura = produto["dias_cobertura"]
            if dias_cobertura is not None and dias_cobertura <= Decimal("1"):
                prioridades.append(
                    self._prioridade(
                        "ruptura_prevista",
                        "critica",
                        95,
                        produto["produto_id"],
                        produto["produto_nome"],
                        f"{produto['produto_nome']} pode acabar em até 1 dia.",
                        "A média diária de venda supera a cobertura do estoque vendável.",
                        "Repor estoque com urgência",
                        "Risco de perder vendas por falta de produto.",
                        self._metricas_produto(produto),
                        produto["valor_estoque_custo"],
                        dias_cobertura=dias_cobertura,
                    )
                )

            if produto["estoque_baixo"]:
                pontuacao = 90 if produto["media_venda_diaria"] > Decimal("0") else 80
                prioridade = "alta" if produto["media_venda_diaria"] > Decimal("0") else "media"
                prioridades.append(
                    self._prioridade(
                        "estoque_baixo",
                        prioridade,
                        pontuacao,
                        produto["produto_id"],
                        produto["produto_nome"],
                        f"{produto['produto_nome']} está abaixo do estoque mínimo.",
                        f"Estoque vendável de {self._float(produto['estoque_disponivel_venda'])} "
                        f"{produto['unidade_medida']} contra mínimo de {self._float(produto['estoque_minimo'])}.",
                        "Planejar reposição",
                        "Pode afetar o atendimento se o giro continuar.",
                        self._metricas_produto(produto),
                        produto["valor_estoque_custo"],
                        dias_cobertura=dias_cobertura,
                    )
                )

        for item in risco_validade["proximos_vencimento"]:
            prioridade = "alta" if item["dias_para_vencer"] <= 1 else "media"
            pontuacao = 85 if item["dias_para_vencer"] <= 1 else 75
            prioridades.append(
                self._prioridade(
                    "validade_proxima",
                    prioridade,
                    pontuacao,
                    item["produto_id"],
                    item["produto_nome"],
                    f"{item['produto_nome']} está próximo do vencimento.",
                    f"Validade em {item['dias_para_vencer']} dia(s), com {item['quantidade_em_risco']} "
                    f"{item['unidade_medida']} em risco.",
                    item["acao_sugerida"],
                    f"R$ {item['valor_em_risco']:.2f} em custo sob risco.",
                    {"quantidade_em_risco": item["quantidade_em_risco"], "valor_em_risco": item["valor_em_risco"]},
                    item["valor_em_risco"],
                    data_validade=item["data_validade"],
                )
            )

        if perdas_relevantes:
            for item in analise_perdas:
                prioridades.append(
                    self._prioridade(
                        "perda_alta",
                        "alta",
                        70,
                        item["produto_id"],
                        item["produto_nome"],
                        f"{item['produto_nome']} concentrou perdas no período.",
                        f"Foram {item['total_registros']} registro(s), principalmente por {item['principal_tipo']}.",
                        item["acao_sugerida"],
                        f"R$ {item['custo_total']:.2f} em perdas.",
                        {"custo_total": item["custo_total"], "total_registros": item["total_registros"]},
                        item["custo_total"],
                    )
                )

        for item in analise_margem:
            if item["classificacao"] not in ("critica", "baixa"):
                continue
            prioridades.append(
                self._prioridade(
                    "margem_baixa",
                    "alta" if item["classificacao"] == "critica" else "media",
                    60,
                    item["produto_id"],
                    item["produto_nome"],
                    f"{item['produto_nome']} vendeu com margem {item['classificacao']}.",
                    f"Margem de {item['margem_percentual']:.2f}% no período.",
                    item["acao_sugerida"],
                    f"Receita de R$ {item['receita_total']:.2f} gerou lucro de R$ {item['lucro_bruto_total']:.2f}.",
                    item,
                    item["receita_total"],
                )
            )

        for item in produtos_parados:
            produto = analises_por_id.get(item["produto_id"])
            prioridades.append(
                self._prioridade(
                    "produto_parado",
                    "baixa",
                    45,
                    item["produto_id"],
                    item["produto_nome"],
                    f"{item['produto_nome']} está parado com estoque disponível.",
                    "Produto ativo com estoque e sem venda recente ou giro muito baixo.",
                    item["acao_sugerida"],
                    f"R$ {item['valor_parado_custo']:.2f} parados em estoque.",
                    item,
                    item["valor_parado_custo"],
                    dias_cobertura=produto["dias_cobertura"] if produto else None,
                )
            )

        prioridades.sort(
            key=lambda item: (
                self.PRIORIDADE_ORDEM[item["prioridade"]],
                -item["pontuacao"],
                -item["_impacto_ordenacao"],
                item["_dias_cobertura_ordenacao"],
                item["_data_validade_ordenacao"],
            )
        )
        return prioridades

    def _calcular_saude_operacional(
        self,
        prioridades,
        risco_validade,
        analises_produtos,
        produtos_parados,
        perdas_total_custo,
        lucro_bruto_total,
        margem_geral,
        sugestoes_reposicao,
    ):
        vencidos = len(risco_validade["vencidos"])
        proximos = len(risco_validade["proximos_vencimento"])
        estoque_baixo = sum(1 for produto in analises_produtos if produto["estoque_baixo"])
        rupturas = sum(1 for produto in analises_produtos if produto["dias_cobertura"] is not None and produto["dias_cobertura"] <= Decimal("1"))
        parados_relevantes = sum(1 for produto in produtos_parados if produto["valor_parado_custo"] >= 50)
        compras_prioritarias = len(sugestoes_reposicao)
        perdas_relevantes = perdas_total_custo > Decimal("0") and (
            lucro_bruto_total <= Decimal("0")
            or perdas_total_custo / lucro_bruto_total >= Decimal("0.15")
        )
        houve_vendas = any(produto["quantidade_vendida_periodo"] > Decimal("0") for produto in analises_produtos)
        margem_baixa = houve_vendas and margem_geral < self.MARGEM_BAIXA_PERCENTUAL
        valor_estoque_custo = sum(
            (self._decimal(produto["valor_estoque_custo"]) for produto in analises_produtos),
            Decimal("0"),
        )
        valor_em_risco = self._decimal(risco_validade["valor_em_risco"])
        receita_total = sum(
            (self._decimal(produto["receita_total"]) for produto in analises_produtos),
            Decimal("0"),
        )
        produtos_ativos = max(len(analises_produtos), 1)
        percentual_valor_em_risco = self._percentual(valor_em_risco, valor_estoque_custo)
        percentual_perdas_sobre_receita = self._percentual(perdas_total_custo, receita_total)
        percentual_parados_relevantes = Decimal(parados_relevantes) / Decimal(produtos_ativos) * Decimal("100")
        penalidade_margem = self._penalidade_margem(margem_geral, houve_vendas)

        pilares = {
            "validade": {
                "score": self._float(
                    self._limitar_score(
                        Decimal("100")
                        - min(Decimal(vencidos) * Decimal("5"), Decimal("30"))
                        - min(Decimal(proximos) * Decimal("1.5"), Decimal("15"))
                        - min(percentual_valor_em_risco, Decimal("30"))
                    ),
                    0,
                ),
                "peso": 0.35,
                "fatores": {
                    "vencidos": vencidos,
                    "proximos_vencimento": proximos,
                    "valor_em_risco": self._float(valor_em_risco, 2),
                    "percentual_valor_em_risco": self._float(percentual_valor_em_risco, 1),
                },
            },
            "estoque": {
                "score": self._float(
                    self._limitar_score(
                        Decimal("100")
                        - min(Decimal(rupturas) * Decimal("25"), Decimal("50"))
                        - min(Decimal(estoque_baixo) * Decimal("6"), Decimal("25"))
                        - min(Decimal(compras_prioritarias) * Decimal("4"), Decimal("20"))
                    ),
                    0,
                ),
                "peso": 0.25,
                "fatores": {
                    "rupturas_previstas": rupturas,
                    "estoque_baixo": estoque_baixo,
                    "compras_prioritarias": compras_prioritarias,
                },
            },
            "financeiro": {
                "score": self._float(
                    self._limitar_score(
                        Decimal("100")
                        - min(percentual_perdas_sobre_receita * Decimal("0.8"), Decimal("45"))
                        - penalidade_margem
                    ),
                    0,
                ),
                "peso": 0.25,
                "fatores": {
                    "perdas_total_custo": self._float(perdas_total_custo, 2),
                    "percentual_perdas_sobre_receita": self._float(percentual_perdas_sobre_receita, 1),
                    "margem_lucro_percentual": self._float(margem_geral, 1),
                    "penalidade_margem": self._float(penalidade_margem, 0),
                },
            },
            "giro": {
                "score": self._float(
                    self._limitar_score(
                        Decimal("100")
                        - min(percentual_parados_relevantes * Decimal("0.6"), Decimal("45"))
                    ),
                    0,
                ),
                "peso": 0.15,
                "fatores": {
                    "produtos_parados_relevantes": parados_relevantes,
                    "produtos_ativos": produtos_ativos,
                    "percentual_parados_relevantes": self._float(percentual_parados_relevantes, 1),
                },
            },
        }
        score = self._limitar_score(
            sum(
                self._decimal(pilar["score"]) * self._decimal(pilar["peso"])
                for pilar in pilares.values()
            )
        )

        if score >= Decimal("80"):
            classificacao = "saudavel"
            mensagem = "Operação saudável, sem riscos críticos no momento."
        elif score >= Decimal("50"):
            classificacao = "atencao"
            mensagem = "Operação requer atenção por risco de validade e reposição."
        else:
            classificacao = "critica"
            mensagem = "Operação crítica: existem produtos vencidos, ruptura prevista ou perdas relevantes."

        if classificacao == "saudavel":
            mensagem = "Operação saudável, com riscos sob controle no momento."
        elif classificacao == "atencao":
            mensagem = self._mensagem_saude_atencao(pilares)
        else:
            mensagem = self._mensagem_saude_critica(pilares)

        return {
            "score": self._float(score, 0),
            "classificacao": classificacao,
            "mensagem": mensagem,
            "pilares": pilares,
            "fatores": {
                "vencidos": vencidos,
                "proximos_vencimento": proximos,
                "estoque_baixo": estoque_baixo,
                "rupturas_previstas": rupturas,
                "produtos_parados_relevantes": parados_relevantes,
                "compras_prioritarias": compras_prioritarias,
                "perdas_relevantes": perdas_relevantes,
                "margem_geral_baixa": margem_baixa,
            },
        }

    def _limitar_score(self, score):
        return max(Decimal("0"), min(self._decimal(score), Decimal("100")))

    def _penalidade_margem(self, margem_geral, houve_vendas):
        if not houve_vendas:
            return Decimal("0")
        if margem_geral >= Decimal("35"):
            return Decimal("0")
        if margem_geral >= Decimal("25"):
            return Decimal("10")
        if margem_geral >= Decimal("15"):
            return Decimal("20")
        return Decimal("35")

    def _mensagem_saude_atencao(self, pilares):
        pior_pilar = self._pior_pilar_saude(pilares)
        mensagens = {
            "validade": "Operação em atenção: validade concentra o maior risco gerencial.",
            "estoque": "Operação em atenção: reposição e cobertura precisam de acompanhamento.",
            "financeiro": "Operação em atenção: perdas ou margem estão pressionando o resultado.",
            "giro": "Operação em atenção: há capital parado em produtos de baixo giro.",
        }
        return mensagens.get(pior_pilar, "Operação em atenção: acompanhe os principais pilares do negócio.")

    def _mensagem_saude_critica(self, pilares):
        pior_pilar = self._pior_pilar_saude(pilares)
        mensagens = {
            "validade": "Operação crítica: validade exige retirada, perda ou promoção imediata.",
            "estoque": "Operação crítica: cobertura e rupturas podem afetar vendas hoje.",
            "financeiro": "Operação crítica: perdas ou margem comprometem o resultado do período.",
            "giro": "Operação crítica: excesso de produtos parados está travando capital.",
        }
        return mensagens.get(pior_pilar, "Operação crítica: trate os riscos prioritários do dashboard.")

    def _pior_pilar_saude(self, pilares):
        return min(pilares.items(), key=lambda item: item[1]["score"])[0]

    def _montar_resumo_executivo(
        self,
        prioridades,
        sugestoes_reposicao,
        risco_validade,
        analise_margem,
        analise_perdas,
        saude_operacional,
    ):
        resumo = []
        criticos = [item for item in prioridades if item["prioridade"] == "critica"]
        if criticos:
            resumo.append(
                {
                    "tipo": "risco",
                    "prioridade": "critica",
                    "mensagem": f"Existem {len(criticos)} alertas críticos hoje; trate vencidos e rupturas primeiro.",
                }
            )
        if sugestoes_reposicao:
            produto = sugestoes_reposicao[0]
            resumo.append(
                {
                    "tipo": "estoque",
                    "prioridade": produto["prioridade"],
                    "mensagem": (
                        f"{produto['produto_nome']} deve ser priorizado na compra: "
                        f"estoque cobre {produto['dias_cobertura']} dia(s) de venda média."
                    ),
                }
            )
        if risco_validade["valor_em_risco"] > 0:
            resumo.append(
                {
                    "tipo": "validade",
                    "prioridade": "alta" if risco_validade["vencidos"] else "media",
                    "mensagem": f"Há R$ {risco_validade['valor_em_risco']:.2f} em estoque vencido ou próximo do vencimento.",
                }
            )
        margens_baixas = [item for item in analise_margem if item["classificacao"] in ("critica", "baixa")]
        if margens_baixas:
            resumo.append(
                {
                    "tipo": "financeiro",
                    "prioridade": "media",
                    "mensagem": f"{len(margens_baixas)} produto(s) vendidos têm margem abaixo de 20%.",
                }
            )
        if analise_perdas:
            produto = analise_perdas[0]
            resumo.append(
                {
                    "tipo": "risco",
                    "prioridade": "alta",
                    "mensagem": f"{produto['produto_nome']} lidera perdas no período com R$ {produto['custo_total']:.2f}.",
                }
            )
        if not resumo:
            resumo.append(
                {
                    "tipo": "oportunidade",
                    "prioridade": "baixa",
                    "mensagem": saude_operacional["mensagem"],
                }
            )

        return resumo

    def _serie_vendas_por_dia(self, data_inicial, data_final):
        rows = self.session.execute(
            select(
                Movimentacao.data,
                func.coalesce(func.sum(Movimentacao.quantidade), 0),
                func.coalesce(func.sum(Movimentacao.receita_total), 0),
            )
            .where(
                Movimentacao.tipo == TipoMovimentacao.SAIDA,
                Movimentacao.subtipo == SubtipoMovimentacao.VENDA,
                Movimentacao.data >= data_inicial,
                Movimentacao.data <= data_final,
            )
            .group_by(Movimentacao.data)
            .order_by(Movimentacao.data.asc())
        ).all()
        por_data = {
            data_movimentacao: {
                "quantidade_vendida": self._float(quantidade),
                "receita_total": self._float(receita, 2),
            }
            for data_movimentacao, quantidade, receita in rows
        }
        serie = []
        dia = data_inicial
        while dia <= data_final:
            valores = por_data.get(dia, {"quantidade_vendida": 0, "receita_total": 0})
            serie.append({"data": dia.isoformat(), **valores})
            dia += timedelta(days=1)
        return serie

    def _alertas_por_tipo(self, prioridades):
        contador = Counter(prioridade["tipo"] for prioridade in prioridades)
        return [{"tipo": tipo, "total": total} for tipo, total in sorted(contador.items())]

    def _prioridade(
        self,
        tipo,
        prioridade,
        pontuacao,
        produto_id,
        produto_nome,
        mensagem,
        causa,
        acao_sugerida,
        impacto_estimado,
        metricas,
        impacto_ordenacao,
        dias_cobertura=None,
        data_validade=None,
    ):
        return {
            "tipo": tipo,
            "prioridade": prioridade,
            "pontuacao": pontuacao,
            "produto_id": produto_id,
            "produto_nome": produto_nome,
            "mensagem": mensagem,
            "causa": causa,
            "acao_sugerida": acao_sugerida,
            "impacto_estimado": impacto_estimado,
            "metricas": metricas,
            "_impacto_ordenacao": float(impacto_ordenacao or 0),
            "_dias_cobertura_ordenacao": float(dias_cobertura) if dias_cobertura is not None else 999999,
            "_data_validade_ordenacao": data_validade or "9999-12-31",
        }

    def _limitar_prioridades(self, prioridades, limite=None):
        itens = []
        prioridades_visiveis = prioridades if limite is None else prioridades[:limite]
        for prioridade in prioridades_visiveis:
            item = dict(prioridade)
            item.pop("_impacto_ordenacao", None)
            item.pop("_dias_cobertura_ordenacao", None)
            item.pop("_data_validade_ordenacao", None)
            itens.append(item)
        return itens

    def _metricas_produto(self, produto):
        return {
            "produto_id": produto["produto_id"],
            "produto_nome": produto["produto_nome"],
            "categoria": produto["categoria"],
            "unidade_medida": produto["unidade_medida"],
            "estoque_atual": self._float(produto["estoque_atual"]),
            "estoque_minimo": self._float(produto["estoque_minimo"]),
            "estoque_disponivel_venda": self._float(produto["estoque_disponivel_venda"]),
            "venda_total_periodo": self._float(produto["quantidade_vendida_periodo"]),
            "media_venda_diaria": self._float(produto["media_venda_diaria"]),
            "dias_cobertura": self._float(produto["dias_cobertura"], 1) if produto["dias_cobertura"] is not None else None,
            "valor_estoque_custo": self._float(produto["valor_estoque_custo"], 2),
        }

    def _acao_validade(self, dias_para_vencer):
        if dias_para_vencer < 0:
            return "Registrar perda ou retirar do estoque imediatamente"
        if dias_para_vencer == 0:
            return "Priorizar venda hoje ou avaliar perda"
        if dias_para_vencer <= 3:
            return "Criar promoção ou priorizar exposição"
        return "Acompanhar validade"

    def _classificar_perda(self, observacao):
        texto = (observacao or "").lower()
        if "venc" in texto or "validade" in texto:
            return "vencimento"
        if "avaria" in texto or "dano" in texto or "amass" in texto or "manuseio" in texto:
            return "avaria"
        return "outros"

    def _arredondar_quantidade(self, quantidade, unidade_medida):
        if quantidade <= Decimal("0"):
            return Decimal("0")
        if unidade_medida in ("un", "cx"):
            return quantidade.to_integral_value(rounding=ROUND_CEILING)
        return quantidade.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

    def _casas_quantidade_reposicao(self, unidade_medida):
        return 0 if unidade_medida in ("un", "cx") else 1

    def _formatar_quantidade_reposicao(self, quantidade, unidade_medida):
        casas = self._casas_quantidade_reposicao(unidade_medida)
        if casas == 0:
            quantidade_texto = str(int(quantidade))
        else:
            quantidade_texto = f"{float(quantidade):.{casas}f}".replace(".", ",")

        return f"{quantidade_texto} {unidade_medida}"

    def _percentual(self, valor, total):
        valor = self._decimal(valor)
        total = self._decimal(total)
        if total <= Decimal("0"):
            return Decimal("0")
        return valor / total * Decimal("100")

    def _decimal(self, valor):
        if valor is None:
            return Decimal("0")
        return Decimal(str(valor))

    def _float(self, valor, casas=3):
        return round(float(valor or 0), casas)

    def _formatar_dias(self, dias):
        if dias is None:
            return "sem histórico"
        if dias <= Decimal("1"):
            return "até 1 dia"
        dias_inteiros = max(int(dias.to_integral_value(rounding=ROUND_HALF_UP)), 1)
        return "1 dia" if dias_inteiros == 1 else f"{dias_inteiros} dias"
