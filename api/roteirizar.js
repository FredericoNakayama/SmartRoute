// POST /api/roteirizar
//  - {cenario: "cenario-1"}  -> DEMONSTRAÇÃO: devolve o resultado gerado antes pelo Claude. Não chama a API do Claude.
//  - {pedidos: [...], rotulo?} -> AO VIVO: chama o Claude de verdade e salva no histórico. Gratuito para o visitante: a API paga é do desenvolvedor.
import { carregarDados } from "../lib/dados.js";
import { criarCliente, ErroIA } from "../lib/claude.js";
import { executarRoteirizacao } from "../lib/roteirizacao.js";
import { salvarRegistro } from "../lib/mockapi.js";
import { permitir } from "../lib/rateLimit.js";
import { lerJson, ipDe, lerCorpo } from "../lib/arquivos.js";
import { sanitizarPedido, sanitizarRotulo } from "../lib/pedidos.js";

const indisponivel = (motivo) =>
  Response.json(
    { modo: "indisponivel", erro: `${motivo} Os 3 cenários prontos continuam disponíveis (demonstração).` },
    { status: 503 },
  );

export async function POST(request) {
  const dados = carregarDados();
  const corpo = await lerCorpo(request);
  if (!corpo) return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });

  // Cenário pronto: sempre o resultado pré-gerado (sem chamar o Claude, sem gravar no histórico).
  if (corpo.cenario) {
    if (!/^cenario-[1-3]$/.test(corpo.cenario)) return Response.json({ erro: "Cenário desconhecido." }, { status: 400 });
    const pronto = await lerJson(`resultados/${corpo.cenario}.json`);
    if (!pronto?.registro) return Response.json({ erro: "Resultado de demonstração indisponível." }, { status: 500 });
    return Response.json({ modo: "demo", registro: pronto.registro, salvo: false });
  }

  if (!Array.isArray(corpo.pedidos)) {
    return Response.json({ erro: "Informe um cenário ou uma lista de pedidos." }, { status: 400 });
  }
  const { max_pedidos } = dados.parametros;
  if (corpo.pedidos.length === 0 || corpo.pedidos.length > max_pedidos) {
    return Response.json({ erro: `Envie de 1 a ${max_pedidos} pedidos.` }, { status: 400 });
  }
  const pedidos = corpo.pedidos.map((p) => sanitizarPedido(p, dados.cidades));
  if (pedidos.includes(null)) return Response.json({ erro: "Há pedidos com campos inválidos." }, { status: 400 });
  const base = await lerJson("cenarios/cenario-1.json");
  const cenario = { ...base, id: "csv", rotulo: sanitizarRotulo(corpo.rotulo), pedidos };

  // CSV: IA ao vivo.
  const client = criarCliente();
  if (!client) return indisponivel("A IA ao vivo não está configurada neste servidor.");
  if (!permitir(ipDe(request))) return indisponivel("Limite de roteirizações ao vivo atingido (5 a cada 10 minutos).");

  let registro;
  try {
    registro = await executarRoteirizacao({ cenario, origem: "csv" }, client, dados);
  } catch (e) {
    if (e instanceof ErroIA) return indisponivel(`A IA não respondeu agora (${e.motivo}).`);
    throw e;
  }

  try {
    return Response.json({ modo: "ao_vivo", registro: await salvarRegistro(registro), salvo: true });
  } catch {
    return Response.json({ modo: "ao_vivo", registro, salvo: false });
  }
}
