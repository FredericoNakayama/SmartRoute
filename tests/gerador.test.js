import { test } from "node:test";
import assert from "node:assert/strict";
import { gerarCenario } from "../lib/gerador.js";
import { carregarDados } from "../lib/dados.js";

const dados = carregarDados();
const base = { id: "x", rotulo: "X", seed: 42, n: 20, data_envio: "2026-11-02", pctRJ: 0.5, pctRestricao: 0.2, pctDedicado: 0.2, paletesMedio: 3 };

test("mesma seed gera o mesmo cenário", () => {
  assert.deepEqual(gerarCenario(base, dados), gerarCenario(base, dados));
});

test("seeds diferentes geram pedidos diferentes", () => {
  assert.notDeepEqual(gerarCenario(base, dados).pedidos, gerarCenario({ ...base, seed: 7 }, dados).pedidos);
});

test("pedidos gerados são válidos", () => {
  const c = gerarCenario(base, dados);
  assert.equal(c.pedidos.length, 20);
  assert.equal(c.pedidos[0].id, "P001");
  for (const p of c.pedidos) {
    assert.ok(dados.cidades.includes(`${p.cidade}-${p.uf}`), p.cidade);
    assert.ok(p.peso_kg > 0 && Number.isInteger(p.paletes) && p.paletes >= 1);
    assert.ok(p.data_limite_entrega > c.data_envio);
    assert.ok(["", "VUC", "Toco", "Truck", "Carreta"].includes(p.restricao_veiculo));
    assert.equal(typeof p.aceita_fracionado, "boolean");
  }
});

test("disponibilidade cobre as 3 transportadoras e aplica indisponíveis", () => {
  const c = gerarCenario({ ...base, indisponiveis: [{ transportadora: "T1", tipo: "Carreta" }], fatorFracionado: 0.5 }, dados);
  assert.deepEqual(Object.keys(c.disponibilidade), ["T1", "T2", "T3"]);
  assert.equal(c.disponibilidade.T1.veiculos.Carreta, 0);
  assert.ok(c.disponibilidade.T2.veiculos.Carreta > 0);
  assert.ok(c.disponibilidade.T1.fracionado_paletes.RJ < gerarCenario(base, dados).disponibilidade.T1.fracionado_paletes.RJ);
});
