import { test } from "node:test";
import assert from "node:assert/strict";
import { custoEnvio, menorVeiculoQueAtende, custoReferencia } from "../lib/custo.js";
import { carregarDados } from "../lib/dados.js";

const { frota, transportadoras } = carregarDados();
const ped = (id, cidade, uf, paletes, extra = {}) => ({ id, cliente: "C", cidade, uf, peso_kg: paletes * 800, paletes, data_limite_entrega: "2026-11-30", restricao_veiculo: "", aceita_fracionado: true, ...extra });
const porId = (lista) => Object.fromEntries(lista.map((p) => [p.id, p]));

test("lotação: preço do veículo + adicional por cidade extra", () => {
  const ps = [ped("A", "Rio de Janeiro", "RJ", 4), ped("B", "Niterói", "RJ", 4), ped("C", "Niterói", "RJ", 2)];
  const envio = { modalidade: "lotacao", transportadora: "T1", veiculo: "Truck", uf: "RJ", pedidos: ["A", "B", "C"] };
  assert.equal(custoEnvio(envio, porId(ps), transportadoras), 2550 + 180);
});

test("fracionado: por pedido, maior entre preço por palete e mínimo", () => {
  const ps = [ped("A", "Rio de Janeiro", "RJ", 1), ped("B", "Niterói", "RJ", 3)];
  const envio = { modalidade: "fracionado", transportadora: "T1", veiculo: null, uf: "RJ", pedidos: ["A", "B"] };
  assert.equal(custoEnvio(envio, porId(ps), transportadoras), 380 + 630);
});

test("combinação inexistente na tabela tem custo null", () => {
  const ps = [ped("A", "Rio de Janeiro", "RJ", 1)];
  assert.equal(custoEnvio({ modalidade: "lotacao", transportadora: "T2", veiculo: "VUC", uf: "RJ", pedidos: ["A"] }, porId(ps), transportadoras), null);
});

test("menorVeiculoQueAtende respeita capacidade e restrição", () => {
  assert.equal(menorVeiculoQueAtende(ped("A", "Niterói", "RJ", 10), frota).tipo, "Truck");
  assert.equal(menorVeiculoQueAtende(ped("A", "Niterói", "RJ", 10, { restricao_veiculo: "Toco" }), frota), null);
  assert.equal(menorVeiculoQueAtende({ ...ped("A", "Niterói", "RJ", 20), peso_kg: 30000 }, frota), null);
});

test("custoReferencia: um veículo dedicado por pedido, na transportadora mais barata", () => {
  const ps = [ped("A", "Niterói", "RJ", 2), ped("B", "Pelotas", "RS", 10)];
  // A: VUC mais barato no RJ = T1 1450; B: Truck mais barato no RS = T2 5300
  assert.deepEqual(custoReferencia(ps, frota, transportadoras), { custo: 1450 + 5300, nao_atendiveis: [] });
});

test("custoReferencia lista pedido grande demais sem gerar NaN", () => {
  const ps = [ped("A", "Niterói", "RJ", 2), { ...ped("X", "Niterói", "RJ", 20), peso_kg: 30000 }];
  const r = custoReferencia(ps, frota, transportadoras);
  assert.deepEqual(r.nao_atendiveis, ["X"]);
  assert.equal(r.custo, 1450);
});

test("custoReferencia usa fracionado quando nenhum veículo de lotação atende o cliente", () => {
  // restrição Toco (12 paletes) com 14 paletes: só o fracionado da T3 (entrega com Toco) atende
  const p = ped("A", "Niterói", "RJ", 14, { restricao_veiculo: "Toco" });
  assert.deepEqual(custoReferencia([p], frota, transportadoras), { custo: 260 * 14, nao_atendiveis: [] });
});
