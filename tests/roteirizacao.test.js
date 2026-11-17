import { test } from "node:test";
import assert from "node:assert/strict";
import { registroDeResultado } from "../lib/roteirizacao.js";
import { carregarDados } from "../lib/dados.js";

const dados = carregarDados();
const ped = (id, paletes) => ({ id, cliente: "C", cidade: "Niterói", uf: "RJ", peso_kg: paletes * 800, paletes, data_limite_entrega: "2026-11-30", restricao_veiculo: "", aceita_fracionado: true });
const disponibilidade = { T1: { veiculos: { VUC: 2, Toco: 2, Truck: 2, Carreta: 2 }, fracionado_paletes: { RJ: 10, RS: 8 } } };
const cenario = { id: "c", rotulo: "C", data_envio: "2026-11-16", disponibilidade, pedidos: [ped("A", 2), ped("B", 2)] };

test("saving compara só os pedidos que a IA enviou", () => {
  const resultado = {
    envios: [{ modalidade: "lotacao", transportadora: "T1", veiculo: "VUC", uf: "RJ", pedidos: ["A"], justificativa: "" }],
    nao_alocados: [{ pedido_id: "B", motivo: "x" }],
    resumo: "",
  };
  const r = registroDeResultado({ cenario, origem: "cenario", resultado }, dados);
  assert.equal(r.custo_referencia, 1450); // só o pedido A
  assert.equal(r.saving_pct, 0);
});

test("nenhum pedido enviado não mostra saving", () => {
  const resultado = { envios: [], nao_alocados: [{ pedido_id: "A", motivo: "x" }, { pedido_id: "B", motivo: "x" }], resumo: "" };
  assert.equal(registroDeResultado({ cenario, origem: "cenario", resultado }, dados).saving_pct, 0);
});
