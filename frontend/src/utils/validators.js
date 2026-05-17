export function validarProdutoForm(formulario) {
  if (!formulario.nome.trim()) {
    return "Informe o nome do produto.";
  }

  if (formulario.estoque_minimo == null || Number(formulario.estoque_minimo) < 0) {
    return "O estoque minimo deve ser zero ou maior.";
  }

  if (formulario.preco_venda_padrao == null || Number(formulario.preco_venda_padrao) < 0) {
    return "Informe um preco de venda valido.";
  }

  if (formulario.validade_dias_padrao == null || Number(formulario.validade_dias_padrao) < 1) {
    return "A validade padrao deve ser de pelo menos 1 dia.";
  }

  return null;
}

export function validarMovimentacaoForm(formulario, tipo) {
  if (formulario.quantidade == null || Number(formulario.quantidade) <= 0) {
    return "Informe uma quantidade maior que zero.";
  }

  if (tipo === "entrada" && (formulario.custo_unitario == null || Number(formulario.custo_unitario) <= 0)) {
    return "Informe um custo unitario maior que zero para a entrada.";
  }

  return null;
}
