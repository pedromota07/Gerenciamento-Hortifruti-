export default function EstadoVazio({
  icone = "pi pi-inbox",
  titulo,
  descricao,
  acao = null
}) {
  return (
    <div className="empty-state">
      <i className={icone} />
      <strong>{titulo}</strong>
      {descricao ? <span>{descricao}</span> : null}
      {acao}
    </div>
  );
}
