import { test } from "node:test";
import assert from "node:assert/strict";
import { montarRegistro } from "../lib/registro.js";

const validado = {
  custo_total: 1500,
  violacoes: [{ regra: "R7_prazo", mensagem: "x", envio_index: 0, pedido_id: "P1" }],
  envios: [
    { modalidade: "lotacao", transportadora: "T1", veiculo: "Truck", uf: "RJ", pedidos: ["P1", "P2"], paletes: 10, ocupacao_kg: 60, custo: 1000 },
    { modalidade: "fracionado", transportadora: "T3", veiculo: null, uf: "RS", pedidos: ["P3", "P4"], paletes: 5, ocupacao_kg: null, custo: 500 },
  ],
};
const resultado = { envios: [], nao_alocados: [{ pedido_id: "P5", motivo: "R6" }], resumo: "Resumo do dia" };
const base = { rotulo: "Semana 01", origem: "historico", data: "2026-08-03", cenario_id: "semana-01", pedidos: new Array(5).fill({}), validado, resultado };

test("montarRegistro calcula indicadores", () => {
  const r = montarRegistro({ ...base, referencia: { custo: 2000, nao_atendiveis: [] } });
  assert.equal(r.saving_pct, 25);
  assert.equal(r.custo_total, 1500);
  assert.equal(r.custo_referencia, 2000);
  assert.equal(r.custo_por_palete, 100);
  assert.equal(r.ocupacao_media, 60);
  assert.deepEqual(r.mix_veiculos, { VUC: 0, Toco: 0, Truck: 1, Carreta: 0, Fracionado: 2 });
  assert.deepEqual(r.custo_por_transportadora, { T1: 1000, T2: 0, T3: 500 });
  assert.equal(r.n_pedidos, 5);
  assert.equal(r.n_envios, 2);
  assert.equal(r.n_violacoes, 1);
  assert.deepEqual(r.nao_alocados, resultado.nao_alocados);
  assert.equal(r.resumo, "Resumo do dia");
  assert.equal(r.rotulo, "Semana 01");
});

test("referência zero e sem envios não gera NaN", () => {
  const r = montarRegistro({ ...base, validado: { custo_total: 0, violacoes: [], envios: [] }, referencia: { custo: 0, nao_atendiveis: [] } });
  assert.equal(r.saving_pct, 0);
  assert.equal(r.custo_por_palete, 0);
  assert.equal(r.ocupacao_media, 0);
});
