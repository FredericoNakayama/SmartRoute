import { test } from "node:test";
import assert from "node:assert/strict";
import { roteirizarComClaude, compararComClaude, ErroIA, SCHEMA_ROTEIRIZACAO } from "../lib/claude.js";
import { carregarDados } from "../lib/dados.js";

const dados = carregarDados();
const cenario = { id: "c", data_envio: "2026-11-16", disponibilidade: {}, pedidos: [{ id: "P001" }] };
const entrada = { ...dados, cenario };
const ok = { envios: [], nao_alocados: [{ pedido_id: "P001", motivo: "R7" }], resumo: "r" };

function clienteFalso(resposta) {
  const chamadas = [];
  return {
    chamadas,
    beta: {
      messages: {
        stream: (params) => {
          chamadas.push(params);
          return { finalMessage: async () => { if (resposta instanceof Error) throw resposta; return resposta; } };
        },
      },
    },
  };
}

test("usa streaming com espaço para respostas grandes (pico de 55 pedidos)", async () => {
  const c = clienteFalso(respostaTexto(JSON.stringify(ok)));
  await roteirizarComClaude(entrada, c);
  assert.equal(c.chamadas[0].max_tokens, 64000);
});
const respostaTexto = (texto, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "thinking", thinking: "" }, { type: "text", text: texto }] });

test("roteirização chama o modelo com spec, schema e fallback", async () => {
  const c = clienteFalso(respostaTexto(JSON.stringify(ok)));
  const r = await roteirizarComClaude(entrada, c);
  assert.deepEqual(r, ok);
  const p = c.chamadas[0];
  assert.equal(p.model, "claude-sonnet-5-5");
  assert.equal(p.fallbacks, "default");
  assert.ok(p.betas.includes("server-side-fallback-2026-07-01"));
  assert.equal(p.output_config.format.type, "json_schema");
  assert.equal(p.output_config.format.schema, SCHEMA_ROTEIRIZACAO);
  assert.equal(p.output_config.effort, "medium");
  assert.match(p.system, /R10/);
  assert.match(p.messages[0].content, /P001/);
  assert.match(p.messages[0].content, /2026-11-16/);
});

test("recusa vira ErroIA com motivo recusa", async () => {
  const c = clienteFalso({ stop_reason: "refusal", content: [] });
  await assert.rejects(roteirizarComClaude(entrada, c), (e) => e instanceof ErroIA && e.motivo === "recusa");
});

test("JSON inválido ou resposta cortada vira json_invalido", async () => {
  await assert.rejects(roteirizarComClaude(entrada, clienteFalso(respostaTexto("{nao é json"))), (e) => e.motivo === "json_invalido");
  await assert.rejects(roteirizarComClaude(entrada, clienteFalso(respostaTexto("{}", "max_tokens"))), (e) => e.motivo === "json_invalido");
});

test("erro da API vira ErroIA com motivo api", async () => {
  await assert.rejects(roteirizarComClaude(entrada, clienteFalso(new Error("sem créditos"))), (e) => e instanceof ErroIA && e.motivo === "api");
});

test("comparação envia os dois registros sem o detalhe dos envios", async () => {
  const exp = { explicacao: "A custou mais", fatores: [{ fator: "Mais pedidos", impacto: "aumentou", detalhe: "55 x 30" }] };
  const c = clienteFalso(respostaTexto(JSON.stringify(exp)));
  const regA = { id: "1", rotulo: "Semana 04", custo_total: 50000, envios: [{ grande: true }], mix_veiculos: { Truck: 3 } };
  const regB = { id: "2", rotulo: "Semana 03", custo_total: 30000, envios: [{ grande: true }], mix_veiculos: { Truck: 1 } };
  assert.deepEqual(await compararComClaude(regA, regB, c), exp);
  const conteudo = c.chamadas[0].messages[0].content;
  assert.match(conteudo, /Semana 04/);
  assert.match(conteudo, /mix_veiculos/);
  assert.doesNotMatch(conteudo, /grande/);
});

test("cliente da demo não ultrapassa o tempo máximo da função na Vercel (300s)", async () => {
  process.env.ANTHROPIC_API_KEY = "teste";
  const { criarCliente } = await import("../lib/claude.js");
  const c = criarCliente();
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(c.maxRetries, 0);
  assert.ok(c.timeout <= 280_000);
});
