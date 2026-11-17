// POST /api/comparar — corpo {idA, idB}: a IA explica por que A custou mais ou menos que B.
import { criarCliente, compararComClaude, ErroIA } from "../lib/claude.js";
import { listarRegistros } from "../lib/mockapi.js";
import { permitir } from "../lib/rateLimit.js";
import { lerJson, obterHistorico, ipDe, lerCorpo } from "../lib/arquivos.js";

async function modoDemo(idA, idB, aviso) {
  const prontas = await lerJson("comparacoes.json", {});
  const pronta = prontas[`${idA}|${idB}`] ?? prontas[`${idB}|${idA}`];
  if (pronta) return Response.json({ modo: "demo", aviso, ...pronta });
  return Response.json(
    { modo: "demo", erro: `${aviso} No modo demonstração, só os pares pré-selecionados têm explicação pronta.` },
    { status: 503 },
  );
}

export async function POST(request) {
  const corpo = await lerCorpo(request);
  const idA = corpo?.idA != null ? String(corpo.idA) : "";
  const idB = corpo?.idB != null ? String(corpo.idB) : "";
  if (!idA || !idB || idA === idB) return Response.json({ erro: "Escolha duas roteirizações diferentes." }, { status: 400 });

  const { registros } = await obterHistorico(() => listarRegistros());
  const regA = registros.find((r) => String(r.id) === idA);
  const regB = registros.find((r) => String(r.id) === idB);
  if (!regA || !regB) return Response.json({ erro: "Roteirização não encontrada no histórico." }, { status: 400 });

  const client = criarCliente();
  if (!client) return modoDemo(idA, idB, "A IA ao vivo não está configurada.");
  if (!permitir(ipDe(request))) return modoDemo(idA, idB, "Limite de chamadas ao vivo atingido (5 a cada 10 minutos).");

  try {
    return Response.json({ modo: "ao_vivo", ...(await compararComClaude(regA, regB, client)) });
  } catch (e) {
    if (e instanceof ErroIA) return modoDemo(idA, idB, `A IA não respondeu (${e.motivo}).`);
    throw e;
  }
}
