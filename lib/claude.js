// Chamadas ao Claude: roteirização guiada pela spec e explicação de diferenças entre roteirizações.
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-sonnet-5-5"; // metade do custo do Opus; escolha de Frederico para caber no orçamento da demo
const BETAS = ["server-side-fallback-2026-07-01"]; // se o modelo recusar, a API tenta automaticamente outro modelo

export class ErroIA extends Error {
  /** @param {"recusa"|"json_invalido"|"api"} motivo */
  constructor(motivo, mensagem) {
    super(mensagem);
    this.motivo = motivo;
  }
}

const textoObrigatorio = { type: "string" };

export const SCHEMA_ROTEIRIZACAO = {
  type: "object",
  additionalProperties: false,
  required: ["envios", "nao_alocados", "resumo"],
  properties: {
    envios: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["modalidade", "transportadora", "veiculo", "uf", "pedidos", "justificativa"],
        properties: {
          modalidade: { type: "string", enum: ["lotacao", "fracionado"] },
          transportadora: { type: "string", enum: ["T1", "T2", "T3"] },
          veiculo: { anyOf: [{ type: "string", enum: ["VUC", "Toco", "Truck", "Carreta"] }, { type: "null" }] },
          uf: { type: "string", enum: ["RJ", "RS"] },
          pedidos: { type: "array", items: textoObrigatorio },
          justificativa: textoObrigatorio,
        },
      },
    },
    nao_alocados: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pedido_id", "motivo"],
        properties: { pedido_id: textoObrigatorio, motivo: textoObrigatorio },
      },
    },
    resumo: textoObrigatorio,
  },
};

export const SCHEMA_COMPARACAO = {
  type: "object",
  additionalProperties: false,
  required: ["explicacao", "fatores"],
  properties: {
    explicacao: textoObrigatorio,
    fatores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fator", "impacto", "detalhe"],
        properties: {
          fator: textoObrigatorio,
          impacto: { type: "string", enum: ["aumentou", "reduziu"] },
          detalhe: textoObrigatorio,
        },
      },
    },
  },
};

/** Cliente do Claude, ou null se não houver chave configurada (a demo cai no modo demonstração). */
export function criarCliente() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // Sem retry e com folga abaixo dos 300s da função na Vercel: se demorar demais, cai no modo demonstração.
  return new Anthropic({ maxRetries: 0, timeout: 270_000 });
}

async function chamarJson(client, { system, conteudo, schema }) {
  let resposta;
  try {
    // Streaming: dias com muitos pedidos geram respostas longas; evita corte e timeout HTTP.
    resposta = await client.beta.messages.stream({
      model: MODELO,
      max_tokens: 64000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: conteudo }],
    }).finalMessage();
  } catch (e) {
    throw new ErroIA("api", `Falha ao chamar o Claude: ${e.message}`);
  }
  if (resposta.stop_reason === "refusal") throw new ErroIA("recusa", "O modelo recusou a solicitação.");
  if (resposta.stop_reason === "max_tokens") throw new ErroIA("json_invalido", "A resposta foi cortada (limite de tokens).");
  const texto = resposta.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroIA("json_invalido", "A resposta do modelo não é um JSON válido.");
  }
}

/** Roteiriza um cenário seguindo a spec de regras. */
export function roteirizarComClaude({ spec, frota, transportadoras, parametros, cenario }, client) {
  const system =
    "Você é um agente especialista em roteirização de fretes. Siga estritamente a spec abaixo. " +
    "Antes de decidir cada envio, compare as alternativas de custo e confira cada regra obrigatória.\n\n" +
    spec;
  const conteudo =
    "Roteirize as cargas deste dia. Dados em JSON:\n" +
    JSON.stringify({
      data_envio: cenario.data_envio,
      frota,
      transportadoras,
      disponibilidade_do_dia: cenario.disponibilidade,
      parametros: { max_paradas: parametros.max_paradas },
      pedidos: cenario.pedidos,
    });
  return chamarJson(client, { system, conteudo, schema: SCHEMA_ROTEIRIZACAO });
}

const resumoRegistro = ({ envios, rotas, ...resto }) => resto;

/** Explica por que uma roteirização custou mais ou menos que outra. */
export function compararComClaude(registroA, registroB, client) {
  const system =
    "Você é um analista de custos de frete de uma torrefadora de café. Compare duas roteirizações (A e B) " +
    "e explique em português do Brasil, em 2 a 4 parágrafos curtos, por que A custou mais ou menos que B. " +
    "Cite números dos registros (pedidos, paletes, mix de veículos, uso de fracionado, ocupação, custo por palete, " +
    "transportadoras, violações). Liste também os principais fatores e se cada um aumentou ou reduziu o custo de A em relação a B.";
  const conteudo =
    "Roteirização A:\n" + JSON.stringify(resumoRegistro(registroA)) +
    "\n\nRoteirização B:\n" + JSON.stringify(resumoRegistro(registroB));
  return chamarJson(client, { system, conteudo, schema: SCHEMA_COMPARACAO });
}
