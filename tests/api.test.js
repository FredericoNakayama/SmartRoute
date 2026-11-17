import { test, before } from "node:test";
import assert from "node:assert/strict";

before(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.MOCKAPI_URL;
});

const post = (corpo) => new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json" }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
const pedido = (id) => ({ id, cliente: "C", cidade: "Niterói", uf: "RJ", peso_kg: 800, paletes: 1, data_limite_entrega: "2026-11-30", restricao_veiculo: "", aceita_fracionado: true });

test("roteirizar cenário pronto sem chave devolve demonstração", async () => {
  const { POST } = await import("../api/roteirizar.js");
  const r = await POST(post({ cenario: "cenario-1" }));
  assert.equal(r.status, 200);
  const corpo = await r.json();
  assert.equal(corpo.modo, "demo");
  assert.ok(corpo.registro);
});

test("roteirizar CSV sem chave devolve 503 (IA ao vivo indisponível)", async () => {
  const { POST } = await import("../api/roteirizar.js");
  const r = await POST(post({ pedidos: [pedido("P1")] }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).modo, "indisponivel");
});

test("roteirizar rejeita mais de 60 pedidos, lista vazia, pedido malformado, cenário desconhecido e JSON inválido", async () => {
  const { POST } = await import("../api/roteirizar.js");
  assert.equal((await POST(post({ pedidos: Array.from({ length: 61 }, (_, i) => pedido(`P${i}`)) }))).status, 400);
  assert.equal((await POST(post({ pedidos: [] }))).status, 400);
  assert.equal((await POST(post({ pedidos: [{ id: "P1", uf: "SP" }] }))).status, 400);
  assert.equal((await POST(post({ cenario: "../../etc" }))).status, 400);
  assert.equal((await POST(post("{nao json"))).status, 400);
});

test("histórico sem MockAPI usa dados locais", async () => {
  const { GET } = await import("../api/historico.js");
  const corpo = await (await GET(new Request("http://x/api/historico"))).json();
  assert.equal(corpo.fonte, "local");
  assert.ok(Array.isArray(corpo.registros));
});

test("comparar com ids iguais ou ausentes é 400", async () => {
  const { POST } = await import("../api/comparar.js");
  assert.equal((await POST(post({ idA: "1", idB: "1" }))).status, 400);
  assert.equal((await POST(post({ idA: "1" }))).status, 400);
});

test("spec devolve o markdown", async () => {
  const { GET } = await import("../api/spec.js");
  assert.match((await (await GET(new Request("http://x/api/spec"))).json()).markdown, /R10/);
});

async function comChaveSemRede(fn) {
  const fetchOriginal = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (url) => { chamadas.push(String(url)); throw new Error("rede bloqueada no teste"); };
  process.env.ANTHROPIC_API_KEY = "chave-de-teste";
  try {
    await fn();
  } finally {
    globalThis.fetch = fetchOriginal;
    delete process.env.ANTHROPIC_API_KEY;
  }
  return chamadas.filter((u) => u.includes("anthropic"));
}

test("cenário pronto nunca chama o Claude, mesmo com chave configurada", async () => {
  const { POST } = await import("../api/roteirizar.js");
  const chamadasClaude = await comChaveSemRede(async () => {
    for (let i = 0; i < 7; i++) { // acima do limite de 5 por IP: cenário pronto não consome o limite
      const r = await POST(post({ cenario: "cenario-2" }));
      assert.equal(r.status, 200);
      const corpo = await r.json();
      assert.equal(corpo.modo, "demo");
      assert.equal(corpo.aviso, undefined);
      assert.ok(corpo.registro.n_envios > 0);
    }
  });
  assert.deepEqual(chamadasClaude, []);
});

test("CSV com chave configurada chama o Claude (ao vivo)", async () => {
  const { POST } = await import("../api/roteirizar.js");
  const chamadasClaude = await comChaveSemRede(async () => {
    await POST(new Request("http://x/api", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ pedidos: [pedido("P1")] }) }));
  });
  assert.ok(chamadasClaude.length > 0);
});

test("comparação com explicação pronta não chama o Claude", async () => {
  const { POST } = await import("../api/comparar.js");
  const chamadasClaude = await comChaveSemRede(async () => {
    const r = await POST(post({ idA: "4", idB: "3" }));
    assert.equal(r.status, 200);
    const corpo = await r.json();
    assert.equal(corpo.modo, "demo");
    assert.ok(corpo.explicacao);
  });
  assert.deepEqual(chamadasClaude, []);
});
