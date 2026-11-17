import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("resultados de demonstração são reais, não provisórios", () => {
  for (const id of ["cenario-1", "cenario-2", "cenario-3"]) {
    const { registro } = JSON.parse(readFileSync(`data/resultados/${id}.json`, "utf8"));
    assert.ok(registro.n_envios > 0, `${id} sem envios`);
    assert.doesNotMatch(registro.resumo, /provisório/i, id);
  }
});

test("histórico e comparações prontas existem para o modo demonstração", () => {
  assert.ok(JSON.parse(readFileSync("data/historico.json", "utf8")).length >= 10);
  assert.ok(Object.keys(JSON.parse(readFileSync("data/comparacoes.json", "utf8"))).length >= 3);
});
