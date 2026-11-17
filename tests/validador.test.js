import { test } from "node:test";
import assert from "node:assert/strict";
import { validar } from "../lib/validador.js";
import { carregarDados } from "../lib/dados.js";

const dados = carregarDados();
const ped = (id, cidade, uf, paletes, extra = {}) => ({ id, cliente: "C", cidade, uf, peso_kg: paletes * 800, paletes, data_limite_entrega: "2026-11-30", restricao_veiculo: "", aceita_fracionado: true, ...extra });
const disp = () => {
  const d = {};
  for (const t of ["T1", "T2", "T3"]) d[t] = { veiculos: { VUC: 2, Toco: 2, Truck: 2, Carreta: 2 }, fracionado_paletes: { RJ: 10, RS: 8 } };
  return d;
};
const cen = (pedidos) => ({ id: "t", data_envio: "2026-11-16", disponibilidade: disp(), pedidos });
const lot = (pedidos, extra = {}) => ({ modalidade: "lotacao", transportadora: "T1", veiculo: "Truck", uf: "RJ", pedidos, justificativa: "", ...extra });
const fra = (pedidos, extra = {}) => ({ modalidade: "fracionado", transportadora: "T1", veiculo: null, uf: "RJ", pedidos, justificativa: "", ...extra });
const res = (envios, nao_alocados = []) => ({ envios, nao_alocados, resumo: "" });
const regras = (r) => r.violacoes.map((v) => v.regra);

test("resultado correto não tem violações e soma o custo", () => {
  const c = cen([ped("A", "Rio de Janeiro", "RJ", 4), ped("B", "Niterói", "RJ", 4), ped("C", "Porto Alegre", "RS", 1)]);
  const r = validar(res([lot(["A", "B"]), fra(["C"], { transportadora: "T2", uf: "RS" })]), c, dados);
  assert.deepEqual(r.violacoes, []);
  assert.equal(r.custo_total, 2550 + 180 + 650);
  assert.equal(r.envios[0].paletes, 8);
  assert.equal(r.envios[0].ocupacao_kg, Math.round((6400 / 12000) * 100));
  assert.equal(r.envios[1].ocupacao_kg, null);
});

test("R1: pedido inexistente, duplicado e esquecido", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1), ped("B", "Niterói", "RJ", 1), ped("C", "Niterói", "RJ", 1)]);
  const r = validar(res([lot(["A", "Z"])], [{ pedido_id: "A", motivo: "x" }]), c, dados);
  assert.ok(regras(r).includes("R1_inexistente"));
  assert.ok(regras(r).includes("R1_duplicado"));
  assert.deepEqual(r.violacoes.filter((v) => v.regra === "R1_esquecido").map((v) => v.pedido_id), ["B", "C"]);
});

test("R2: capacidade de peso e de paletes", () => {
  const c = cen([ped("A", "Niterói", "RJ", 10), ped("B", "Niterói", "RJ", 10)]);
  const r = validar(res([lot(["A", "B"])]), c, dados);
  assert.ok(regras(r).includes("R2_capacidade_kg"));
  assert.ok(regras(r).includes("R2_capacidade_paletes"));
});

test("R3: espaço fracionado do dia", () => {
  const c = cen([ped("A", "Niterói", "RJ", 6), ped("B", "Niterói", "RJ", 6)]);
  assert.ok(regras(validar(res([fra(["A", "B"])]), c, dados)).includes("R3_espaco_fracionado"));
});

test("R4: disponibilidade de veículos", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1)]);
  c.disponibilidade.T1.veiculos.Truck = 0;
  assert.ok(regras(validar(res([lot(["A"])]), c, dados)).includes("R4_disponibilidade"));
});

test("R5: combinação que a transportadora não opera", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1)]);
  const r = validar(res([lot(["A"], { transportadora: "T2", veiculo: "VUC" })]), c, dados);
  assert.ok(regras(r).includes("R5_combinacao_invalida"));
  assert.equal(r.custo_total, 0);
});

test("R6: restrição de veículo do cliente, inclusive no fracionado", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1, { restricao_veiculo: "Toco" })]);
  assert.ok(regras(validar(res([lot(["A"])]), c, dados)).includes("R6_restricao_veiculo"));
  assert.ok(regras(validar(res([fra(["A"])]), c, dados)).includes("R6_restricao_veiculo")); // T1 entrega fracionado com Truck
  assert.deepEqual(regras(validar(res([fra(["A"], { transportadora: "T3" })]), c, dados)), []); // T3 entrega com Toco
});

test("R7: prazo de entrega", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1, { data_limite_entrega: "2026-11-17" })]);
  assert.ok(regras(validar(res([lot(["A"])]), c, dados)).includes("R7_prazo")); // T1 RJ = 2 dias
  assert.deepEqual(regras(validar(res([lot(["A"], { transportadora: "T3" })]), c, dados)), []); // T3 RJ = 1 dia
});

test("R8: mistura de UF na mesma lotação", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1), ped("B", "Canoas", "RS", 1)]);
  assert.ok(regras(validar(res([lot(["A", "B"])]), c, dados)).includes("R8_mistura_uf"));
});

test("R9: mais de 4 cidades na lotação", () => {
  const cidades = ["Rio de Janeiro", "Niterói", "Petrópolis", "Volta Redonda", "Resende"];
  const c = cen(cidades.map((cid, i) => ped(`P${i}`, cid, "RJ", 1)));
  assert.ok(regras(validar(res([lot(c.pedidos.map((p) => p.id))]), c, dados)).includes("R9_max_paradas"));
});

test("R10: pedido que exige carga dedicada em fracionado", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1, { aceita_fracionado: false })]);
  assert.ok(regras(validar(res([fra(["A"])]), c, dados)).includes("R10_exige_dedicado"));
});

test("veículo ou transportadora inexistente vira R5 sem quebrar", () => {
  const c = cen([ped("A", "Niterói", "RJ", 1)]);
  assert.ok(regras(validar(res([lot(["A"], { veiculo: "Bitrem" })]), c, dados)).includes("R5_combinacao_invalida"));
  assert.ok(regras(validar(res([lot(["A"], { transportadora: "T9" })]), c, dados)).includes("R5_combinacao_invalida"));
});
