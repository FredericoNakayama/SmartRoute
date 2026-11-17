// Gera, com o Claude de verdade, os resultados de demonstração, o histórico de 12 semanas e as comparações prontas.
// Uso: node --env-file=.env scripts/gerar-historico.js [--so-cenarios] [--limpar-mockapi]
// Custo estimado: ~US$ 1,50–2,00 por execução completa.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { carregarDados } from "../lib/dados.js";
import { executarRoteirizacao } from "../lib/roteirizacao.js";
import { compararComClaude } from "../lib/claude.js";
import { listarRegistros, salvarRegistro } from "../lib/mockapi.js";

const args = new Set(process.argv.slice(2));
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Defina ANTHROPIC_API_KEY no arquivo .env");
  process.exit(1);
}
const client = new Anthropic({ maxRetries: 5, timeout: 300_000 });
const dados = carregarDados();
const lerCenario = (pasta, arquivo) => JSON.parse(readFileSync(`data/${pasta}/${arquivo}`, "utf8"));
const salvarJson = (caminho, obj) => writeFileSync(caminho, JSON.stringify(obj, null, 2) + "\n");

/** Executa tarefas com no máximo `limite` em paralelo (respeita o limite de tokens por minuto da API). */
async function emParalelo(itens, limite, fn) {
  const saida = new Array(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: limite }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i]);
    }
  }));
  return saida;
}

function relatar(registro) {
  const v = registro.violacoes.map((x) => x.regra).join(", ") || "nenhuma";
  console.log(`✔ ${registro.rotulo}: ${registro.n_envios} envios, R$ ${registro.custo_total}, saving ${registro.saving_pct}%, violações: ${v}`);
}

/** Tenta até 2 vezes; em caso de falha registra o erro e devolve null (não perde o que já foi pago). */
async function tentar(rotulo, fn) {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      return await fn();
    } catch (e) {
      console.warn(`✖ ${rotulo} (tentativa ${tentativa}): ${e.message}`);
    }
  }
  return null;
}

// 1) Resultados de demonstração dos 3 cenários prontos
const cenarios = ["cenario-1", "cenario-2", "cenario-3"].map((id) => lerCenario("cenarios", `${id}.json`));
await emParalelo(cenarios, 2, async (cenario) => {
  const registro = await tentar(cenario.rotulo, () => executarRoteirizacao({ cenario, origem: "cenario" }, client, dados));
  if (!registro) return;
  salvarJson(`data/resultados/${cenario.id}.json`, { modo: "demo", registro, salvo: false });
  relatar(registro);
});
if (args.has("--so-cenarios")) process.exit(0);

// 2) Histórico de 12 semanas (MockAPI + cópia local)
if (args.has("--limpar-mockapi")) {
  for (const r of await listarRegistros()) {
    await fetch(`${process.env.MOCKAPI_URL.replace(/\/$/, "")}/roteirizacoes/${r.id}`, { method: "DELETE" });
  }
  console.log("MockAPI limpo.");
}
const semanas = readdirSync("data/semanas").sort().map((f) => lerCenario("semanas", f));
const registros = await emParalelo(semanas, 2, async (cenario) => {
  const registro = await tentar(cenario.rotulo, () => executarRoteirizacao({ cenario, origem: "historico" }, client, dados));
  if (registro) relatar(registro);
  return registro;
});
const porSemana = []; // índice = semana - 1 (null se a semana falhou)
for (let i = 0; i < registros.length; i++) {
  if (!registros[i]) { porSemana.push(null); continue; }
  try {
    porSemana.push(await salvarRegistro(registros[i])); // sequencial: os ids do MockAPI seguem a ordem das semanas
  } catch (e) {
    console.warn(`MockAPI indisponível (${e.message}); usando id local.`);
    porSemana.push({ ...registros[i], id: semanas[i].id });
  }
}
salvarJson("data/historico.json", porSemana.filter(Boolean));

// 3) Comparações prontas para o modo demonstração
const pares = [[4, 3], [6, 5], [7, 6], [8, 7], [10, 9]];
const comparacoes = {};
await emParalelo(pares, 2, async ([a, b]) => {
  const regA = porSemana[a - 1];
  const regB = porSemana[b - 1];
  if (!regA || !regB) return;
  const exp = await tentar(`comparação ${a}×${b}`, () => compararComClaude(regA, regB, client));
  if (!exp) return;
  comparacoes[`${regA.id}|${regB.id}`] = exp;
  console.log(`✔ comparação ${regA.rotulo} × ${regB.rotulo}`);
});
salvarJson("data/comparacoes.json", comparacoes);
console.log("Pronto.");
