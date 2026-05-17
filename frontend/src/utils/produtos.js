export function estoqueEstaBaixo(produto) {
  return (
    Number(produto?.quantidade_disponivel_venda ?? produto?.quantidade_atual ?? 0) <
    Number(produto?.estoque_minimo ?? 0)
  );
}
