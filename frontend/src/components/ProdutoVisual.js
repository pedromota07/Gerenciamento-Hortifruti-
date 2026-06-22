import styles from "./ProdutoVisual.module.css";

const visuaisPorNome = [
  ["banana", "\u{1F34C}"],
  ["laranja", "\u{1F34A}"],
  ["limao", "\u{1F34B}"],
  ["morango", "\u{1F353}"],
  ["uva", "\u{1F347}"],
  ["maca", "\u{1F34E}"],
  ["pera", "\u{1F350}"],
  ["mamao", "\u{1F348}"],
  ["manga", "\u{1F96D}"],
  ["melancia", "\u{1F349}"],
  ["abacaxi", "\u{1F34D}"],
  ["abacate", "\u{1F951}"],
  ["tomate", "\u{1F345}"],
  ["cenoura", "\u{1F955}"],
  ["batata", "\u{1F954}"],
  ["inhame", "\u{1FADA}"],
  ["beterraba", "\u{1FADC}"],
  ["chuchu", "\u{1F952}"],
  ["mandioca", "\u{1FADA}"],
  ["quiabo", "\u{1FADB}"],
  ["alho", "\u{1F9C4}"],
  ["cebola", "\u{1F9C5}"],
  ["pepino", "\u{1F952}"],
  ["abobrinha", "\u{1F952}"],
  ["pimentao", "\u{1FAD1}"],
  ["berinjela", "\u{1F346}"],
  ["brocolis", "\u{1F966}"],
  ["repolho roxo", "\u{1F96C}"],
  ["repolho", "\u{1F96C}"],
  ["alface", "\u{1F96C}"],
  ["couve", "\u{1F96C}"],
  ["coentro", "\u{1F33F}"],
  ["salsa", "\u{1F33F}"],
  ["cebolinha", "\u{1F33F}"],
  ["rucula", "\u{1F96C}"],
  ["espinafre", "\u{1F96C}"],
  ["agriao", "\u{1F96C}"]
];

function normalizarTexto(valor) {
  return String(valor ?? "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obterSimbolo(nome, categoria) {
  const nomeNormalizado = normalizarTexto(nome);
  const visualEncontrado = visuaisPorNome.find(([termo]) => nomeNormalizado.includes(termo));

  if (visualEncontrado) {
    return visualEncontrado[1];
  }

  if (categoria === "fruta") {
    return "\u{1F34E}";
  }

  return categoria === "verdura" ? "\u{1F96C}" : "\u{1F955}";
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
