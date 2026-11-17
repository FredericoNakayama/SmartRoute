// POST /api/comparar — corpo {idA, idB}: explica por que A custou mais ou menos que B.
//  - Par com explicação pronta (gerada antes pelo Claude) -> DEMONSTRAÇÃO, sem chamar a API do Claude.
//  - Qualquer outro par -> AO VIVO: chama o Claude. Gratuito para o visitante: a API paga é do desenvolvedor.
import { criarCliente, compararComClaude, ErroIA } from "../lib/claude.js";
import { listarRegistros } from "../lib/mockapi.js";
import { permitir } from "../lib/rateLimit.js";
import { lerJson, obterHistorico, ipDe, lerCorpo } from "../lib/arquivos.js";

const indisponivel = (motivo) =>
  Response.json(
    { modo: "indisponivel", erro: `${motivo} Os pares marcados como "explicação pronta" continuam disponíveis.` },
    { status: 503 },
  );

export async function POST(request) {
  const corpo = await lerCorpo(request);
  const idA = corpo?.idA != null ? String(corpo.idA) : "";
  const idB = corpo?.idB != null ? String(corpo.idB) : "";
  if (!idA || !idB || idA === idB) return Response.json({ erro: "Escolha duas roteirizações diferentes." }, { status: 400 });

  // A explicação pronta só vale na mesma ordem (A × B): ela fala de "A" e "B".
  const prontas = await lerJson("comparacoes.json", {});
  const pronta = prontas[`${idA}|${idB}`];
  if (pronta) return Response.json({ modo: "demo", ...pronta });

  const { registros } = await obterHistorico(() => listarRegistros());
  const regA = registros.find((r) => String(r.id) === idA);
  const regB = registros.find((r) => String(r.id) === idB);
  if (!regA || !regB) return Response.json({ erro: "Roteirização não encontrada no histórico." }, { status: 400 });

  const client = criarCliente();
  if (!client) return indisponivel("A IA ao vivo não está configurada neste servidor.");
  if (!permitir(ipDe(request))) return indisponivel("Limite de chamadas ao vivo atingido (5 a cada 10 minutos).");

  try {
    return Response.json({ modo: "ao_vivo", ...(await compararComClaude(regA, regB, client)) });
  } catch (e) {
    if (e instanceof ErroIA) return indisponivel(`A IA não respondeu agora (${e.motivo}).`);
    throw e;
  }
}

/** GET /api/comparar — lista os pares com explicação pronta (para a tela marcá-los como demonstração). */
export async function GET() {
  return Response.json({ prontas: Object.keys(await lerJson("comparacoes.json", {})) });
}
