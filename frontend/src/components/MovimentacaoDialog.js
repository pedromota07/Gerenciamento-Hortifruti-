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

export default function MovimentacaoDialog({
  visible,
  tipo,
  produtoLabel,
  formulario,
  salvando,
  styles,
  idPrefix = "movimentacao",
  onChange,
  onHide,
  onSubmit
}) {
  const entrada = tipo === "entrada";
  const titulo = entrada ? "Registrar Entrada" : "Registrar Saida";
  const rotuloSalvar = entrada ? "Salvar Entrada" : "Salvar Saida";

  function atualizarCampo(campo, valor) {
    onChange((formularioAtual) => ({ ...formularioAtual, [campo]: valor }));
  }

  return (
    <Dialog
      visible={visible}
      header={titulo}
      style={{ width: "min(92vw, 640px)" }}
      onHide={onHide}
    >
      <form className={styles.form} onSubmit={(evento) => onSubmit(evento, tipo)}>
        {produtoLabel ? (
          <div className={styles.field}>
            <label>Produto</label>
            <InputText value={produtoLabel} disabled />
          </div>
        ) : null}

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={`${idPrefix}-quantidade`}>Quantidade</label>
            <InputNumber
              id={`${idPrefix}-quantidade`}
              inputId={`${idPrefix}-quantidade-input`}
              min={0}
              minFractionDigits={0}
              maxFractionDigits={3}
              mode="decimal"
              value={formulario.quantidade}
              onValueChange={(evento) => atualizarCampo("quantidade", evento.value)}
            />
          </div>

          {entrada ? (
            <div className={styles.field}>
              <label htmlFor={`${idPrefix}-custo-unitario`}>Custo unitario</label>
              <InputNumber
                id={`${idPrefix}-custo-unitario`}
                inputId={`${idPrefix}-custo-unitario-input`}
                min={0}
                minFractionDigits={2}
                maxFractionDigits={2}
                mode="decimal"
                value={formulario.custo_unitario}
                onValueChange={(evento) => atualizarCampo("custo_unitario", evento.value)}
              />
            </div>
          ) : null}

          {!entrada ? (
            <div className={styles.field}>
              <label htmlFor={`${idPrefix}-subtipo`}>Tipo da saida</label>
              <Dropdown
                id={`${idPrefix}-subtipo`}
                value={formulario.subtipo}
                options={opcoesSubtipoSaida}
                onChange={(evento) => atualizarCampo("subtipo", evento.value)}
              />
            </div>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${idPrefix}-observacao`}>Observacao</label>
          <InputTextarea
            id={`${idPrefix}-observacao`}
            rows={4}
            value={formulario.observacao}
            onChange={(evento) => atualizarCampo("observacao", evento.target.value)}
          />
        </div>

        <div className={styles.dialogFooter}>
          <Button label="Cancelar" type="button" text onClick={onHide} />
          <Button label={rotuloSalvar} type="submit" loading={salvando} />
        </div>
      </form>
    </Dialog>
  );
}
