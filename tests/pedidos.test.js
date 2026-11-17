import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizarPedido, sanitizarRotulo } from "../lib/pedidos.js";
import { carregarDados } from "../lib/dados.js";

const { cidades } = carregarDados();
const base = { id: "P1", cliente: "C", cidade: "Niterói", uf: "RJ", peso_kg: 800, paletes: 1, data_limite_entrega: "2026-11-30", restricao_veiculo: "", aceita_fracionado: true };

test("sanitizarPedido mantém só os campos conhecidos e limita o texto", () => {
  const p = sanitizarPedido({ ...base, cliente: "x".repeat(500), extra: "ignore isto" }, cidades);
  assert.equal(p.cliente.length, 60);
  assert.equal(p.extra, undefined);
  assert.deepEqual(Object.keys(p).sort(), Object.keys(base).sort());
});

test("sanitizarPedido rejeita tipos errados", () => {
  assert.equal(sanitizarPedido({ ...base, peso_kg: "100" }, cidades), null);
  assert.equal(sanitizarPedido({ ...base, uf: "SP" }, cidades), null);
  assert.equal(sanitizarPedido({ ...base, id: "x".repeat(40) }, cidades), null);
});

test("sanitizarRotulo remove caracteres estranhos e limita o tamanho", () => {
  assert.equal(sanitizarRotulo("<b>pedidos!</b> de hoje"), "bpedidosb de hoje");
  assert.equal(sanitizarRotulo("a".repeat(100)).length, 40);
  assert.equal(sanitizarRotulo(""), "CSV enviado");
});
