"use client";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";

const opcoesSubtipoSaida = [
  { label: "Venda", value: "venda" },
  { label: "Perda", value: "perda" }
];

export default function ModalMovimentacao({
  visivel,
  tipo,
  rotuloProduto,
  formulario,
  salvando,
  estilos,
  prefixoId = "movimentacao",
  aoAlterar,
  aoFechar,
  aoEnviar
}) {
  const entrada = tipo === "entrada";
  const titulo = entrada ? "Registrar Entrada" : "Registrar Saída";
  const rotuloSalvar = entrada ? "Salvar Entrada" : "Salvar Saída";

  function atualizarCampo(campo, valor) {
    aoAlterar((formularioAtual) => ({ ...formularioAtual, [campo]: valor }));
  }

  return (
    <Dialog
      visible={visivel}
      header={titulo}
      style={{ width: "min(92vw, 640px)" }}
      onHide={aoFechar}
    >
      <form className={estilos.form} onSubmit={(evento) => aoEnviar(evento, tipo)}>
        {rotuloProduto ? (
          <div className={estilos.field}>
            <label>Produto</label>
            <InputText value={rotuloProduto} disabled />
          </div>
        ) : null}

        <div className={estilos.row}>
          <div className={estilos.field}>
            <label htmlFor={`${prefixoId}-quantidade`}>Quantidade</label>
            <InputNumber
              id={`${prefixoId}-quantidade`}
              inputId={`${prefixoId}-quantidade-input`}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={3}
              mode="decimal"
              value={formulario.quantidade}
              onValueChange={(evento) => atualizarCampo("quantidade", evento.value)}
            />
          </div>

          {entrada ? (
            <div className={estilos.field}>
              <label htmlFor={`${prefixoId}-custo-unitario`}>Custo unitário</label>
              <InputNumber
                id={`${prefixoId}-custo-unitario`}
                inputId={`${prefixoId}-custo-unitario-input`}
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                mode="currency"
                currency="BRL"
                locale="pt-BR"
                value={formulario.custo_unitario}
                onFocus={(evento) => evento.target.select()}
                onValueChange={(evento) => atualizarCampo("custo_unitario", evento.value)}
              />
            </div>
          ) : null}

          {!entrada ? (
            <div className={estilos.field}>
              <label htmlFor={`${prefixoId}-subtipo`}>Tipo da saída</label>
              <Dropdown
                id={`${prefixoId}-subtipo`}
                value={formulario.subtipo}
                options={opcoesSubtipoSaida}
                onChange={(evento) => atualizarCampo("subtipo", evento.value)}
              />
            </div>
          ) : null}
        </div>

        <div className={estilos.field}>
          <label htmlFor={`${prefixoId}-observacao`}>Observação</label>
          <InputTextarea
            id={`${prefixoId}-observacao`}
            rows={4}
            value={formulario.observacao}
            onChange={(evento) => atualizarCampo("observacao", evento.target.value)}
          />
        </div>

        <div className={estilos.dialogFooter}>
          <Button label="Cancelar" type="button" text onClick={aoFechar} />
          <Button label={rotuloSalvar} type="submit" loading={salvando} />
        </div>
      </form>
    </Dialog>
  );
}
