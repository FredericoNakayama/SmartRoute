import { test } from "node:test";
import assert from "node:assert/strict";
import { carregarDados } from "../lib/dados.js";

test("carregarDados traz frota em ordem crescente de capacidade", () => {
  const { frota } = carregarDados();
  assert.deepEqual(frota.map((v) => v.tipo), ["VUC", "Toco", "Truck", "Carreta"]);
  for (let i = 1; i < frota.length; i++) assert.ok(frota[i].capacidade_kg > frota[i - 1].capacidade_kg);
});

test("carregarDados traz 10 cidades, 3 transportadoras, parâmetros e spec", () => {
  const { cidades, transportadoras, parametros, spec } = carregarDados();
  assert.equal(cidades.length, 10);
  assert.deepEqual(transportadoras.map((t) => t.id), ["T1", "T2", "T3"]);
  assert.equal(parametros.max_pedidos, 60);
  assert.equal(parametros.max_paradas, 4);
  assert.match(spec, /R1/);
  assert.match(spec, /R10/);
});
