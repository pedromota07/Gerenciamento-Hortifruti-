export function estoqueEstaBaixo(produto) {
  if (!produto?.ativo) {
    return false;
  }

  return (
    Number(produto?.quantidade_disponivel_venda ?? produto?.quantidade_atual ?? 0) <
    Number(produto?.estoque_minimo ?? 0)
  );
}

export function produtoTemEstoqueVencido(produto) {
  return Number(produto?.quantidade_vencida ?? 0) > 0;
}

export function produtoProximoDoVencimento(produto, dias = 3) {
  if (!produto?.proxima_validade) {
    return false;
  }

  const hoje = new Date(`${new Date().toLocaleDateString("en-CA")}T00:00:00`);
  const validade = new Date(`${produto.proxima_validade}T00:00:00`);
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + dias);

  return validade >= hoje && validade <= limite;
}
