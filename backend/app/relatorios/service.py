from datetime import date, timedelta

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
