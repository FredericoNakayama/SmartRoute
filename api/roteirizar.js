// POST /api/roteirizar — corpo {cenario: "cenario-1"} ou {pedidos: [...], rotulo?}
import { carregarDados } from "../lib/dados.js";
import { criarCliente, ErroIA } from "../lib/claude.js";
import { executarRoteirizacao } from "../lib/roteirizacao.js";
import { salvarRegistro } from "../lib/mockapi.js";
import { permitir } from "../lib/rateLimit.js";
import { lerJson, ipDe, lerCorpo } from "../lib/arquivos.js";

import { sanitizarPedido, sanitizarRotulo } from "../lib/pedidos.js";

async function modoDemo(cenarioId, aviso) {
  if (cenarioId) {
    const pronto = await lerJson(`resultados/${cenarioId}.json`);
    if (pronto?.registro) return Response.json({ ...pronto, modo: "demo", salvo: false, aviso });
  }
  return Response.json(
    { modo: "demo", erro: `${aviso} No modo demonstração, use um dos cenários prontos.` },
    { status: 503 },
  );
}

export async function POST(request) {
  const dados = carregarDados();
  const corpo = await lerCorpo(request);
  if (!corpo) return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });

  let cenario;
  let cenarioId = null;
  if (corpo.cenario) {
    if (!/^cenario-[1-3]$/.test(corpo.cenario)) return Response.json({ erro: "Cenário desconhecido." }, { status: 400 });
    cenarioId = corpo.cenario;
    cenario = await lerJson(`cenarios/${cenarioId}.json`);
  } else if (Array.isArray(corpo.pedidos)) {
    const { max_pedidos } = dados.parametros;
    if (corpo.pedidos.length === 0 || corpo.pedidos.length > max_pedidos) {
      return Response.json({ erro: `Envie de 1 a ${max_pedidos} pedidos.` }, { status: 400 });
    }
    const pedidos = corpo.pedidos.map((p) => sanitizarPedido(p, dados.cidades));
    if (pedidos.includes(null)) {
      return Response.json({ erro: "Há pedidos com campos inválidos." }, { status: 400 });
    }
    const base = await lerJson("cenarios/cenario-1.json");
    cenario = { ...base, id: "csv", rotulo: sanitizarRotulo(corpo.rotulo), pedidos };
  } else {
    return Response.json({ erro: "Informe um cenário ou uma lista de pedidos." }, { status: 400 });
  }

  const client = criarCliente();
  if (!client) return modoDemo(cenarioId, "A IA ao vivo não está configurada.");
  if (!permitir(ipDe(request))) return modoDemo(cenarioId, "Limite de roteirizações ao vivo atingido (5 a cada 10 minutos).");

  let registro;
  try {
    registro = await executarRoteirizacao({ cenario, origem: cenarioId ? "cenario" : "csv" }, client, dados);
  } catch (e) {
    if (e instanceof ErroIA) return modoDemo(cenarioId, `A IA não respondeu (${e.motivo}).`);
    throw e;
  }

  try {
    const salvo = await salvarRegistro(registro);
    return Response.json({ modo: "ao_vivo", registro: salvo, salvo: true });
  } catch {
    return Response.json({ modo: "ao_vivo", registro, salvo: false });
  }
}
