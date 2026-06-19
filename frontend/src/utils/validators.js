export function obterErrosProdutoForm(formulario) {
  const erros = {};

  if (!formulario.nome.trim()) {
    erros.nome = "Informe o nome do produto.";
  }

  if (!formulario.categoria) {
    erros.categoria = "Selecione a categoria.";
  }

  if (!formulario.unidade_medida) {
    erros.unidade_medida = "Selecione a unidade de medida.";
  }

  if (formulario.estoque_minimo == null || Number(formulario.estoque_minimo) < 0) {
    erros.estoque_minimo = "O estoque mínimo deve ser zero ou maior.";
  }

  if (formulario.preco_venda_padrao == null || Number(formulario.preco_venda_padrao) < 0) {
    erros.preco_venda_padrao = "Informe um preço de venda válido.";
  }

  if (formulario.validade_dias_padrao == null || Number(formulario.validade_dias_padrao) < 1) {
    erros.validade_dias_padrao = "A validade padrão deve ser de pelo menos 1 dia.";
  }

  return erros;
}

export function validarProdutoForm(formulario) {
  return Object.values(obterErrosProdutoForm(formulario))[0] ?? null;
}

export function validarMovimentacaoForm(formulario, tipo) {
  if (formulario.quantidade == null || Number(formulario.quantidade) <= 0) {
    return "Informe uma quantidade maior que zero.";
  }

  if (tipo === "entrada" && (formulario.custo_unitario == null || Number(formulario.custo_unitario) <= 0)) {
    return "Informe um custo unitário maior que zero para a entrada.";
  }

  return null;
}
