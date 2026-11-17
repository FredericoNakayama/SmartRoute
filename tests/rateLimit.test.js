import { test } from "node:test";
import assert from "node:assert/strict";
import { permitir, _resetar } from "../lib/rateLimit.js";

test("5 chamadas por IP a cada 10 minutos", () => {
  _resetar();
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(permitir("1.1.1.1", t0 + i), true);
  assert.equal(permitir("1.1.1.1", t0 + 10), false);
  assert.equal(permitir("2.2.2.2", t0 + 10), true);
  assert.equal(permitir("1.1.1.1", t0 + 10 * 60 * 1000 + 5), true);
});
