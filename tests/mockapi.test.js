import { test } from "node:test";
import assert from "node:assert/strict";
import { listarRegistros, salvarRegistro } from "../lib/mockapi.js";

const URL_BASE = "https://exemplo.mockapi.io/api/v1";
const resposta = (status, corpo) => ({ ok: status < 300, status, json: async () => corpo });

test("salvarRegistro faz POST em /roteirizacoes com JSON", async () => {
  process.env.MOCKAPI_URL = URL_BASE;
  let chamada;
  const salvo = await salvarRegistro({ rotulo: "x" }, async (url, opcoes) => { chamada = { url, opcoes }; return resposta(201, { id: "1", rotulo: "x" }); });
  assert.equal(chamada.url, `${URL_BASE}/roteirizacoes`);
  assert.equal(chamada.opcoes.method, "POST");
  assert.equal(JSON.parse(chamada.opcoes.body).rotulo, "x");
  assert.equal(chamada.opcoes.headers["content-type"], "application/json");
  assert.deepEqual(salvo, { id: "1", rotulo: "x" });
});

test("listarRegistros faz GET e devolve a lista", async () => {
  process.env.MOCKAPI_URL = URL_BASE;
  const lista = await listarRegistros(async (url) => { assert.equal(url, `${URL_BASE}/roteirizacoes`); return resposta(200, [{ id: "1" }]); });
  assert.deepEqual(lista, [{ id: "1" }]);
});

test("status de erro ou URL ausente rejeitam", async () => {
  process.env.MOCKAPI_URL = URL_BASE;
  await assert.rejects(listarRegistros(async () => resposta(500, {})));
  delete process.env.MOCKAPI_URL;
  await assert.rejects(listarRegistros(async () => resposta(200, [])));
});
