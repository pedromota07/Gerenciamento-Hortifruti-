import styles from "./ProdutoVisual.module.css";

const visuaisPorNome = [
  ["banana", "🍌"],
  ["laranja", "🍊"],
  ["morango", "🍓"],
  ["cenoura", "🥕"],
  ["tomate", "🍅"],
  ["batata", "🥔"],
  ["alface", "🥬"],
  ["couve", "🥬"],
  ["abobrinha", "🥒"],
  ["mamão", "🍈"],
  ["mamao", "🍈"]
];

function obterSimbolo(nome, categoria) {
  const nomeNormalizado = String(nome ?? "").toLocaleLowerCase("pt-BR");
  const visualEncontrado = visuaisPorNome.find(([termo]) => nomeNormalizado.includes(termo));

  if (visualEncontrado) {
    return visualEncontrado[1];
  }

  if (categoria === "fruta") {
    return "🍎";
  }

  return categoria === "verdura" ? "🥬" : "🥕";
}

export default function ProdutoVisual({ nome, categoria, tamanho = "padrao", className = "" }) {
  const tom = ["fruta", "legume", "verdura"].includes(categoria) ? categoria : "neutro";

  return (
    <span
      className={`${styles.visual} ${styles[`visual_${tom}`]} ${styles[`visual_${tamanho}`]} ${className}`.trim()}
      aria-hidden="true"
    >
      {obterSimbolo(nome, categoria)}
    </span>
  );
}
