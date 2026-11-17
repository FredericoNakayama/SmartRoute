// Fluxo completo de uma roteirização: Claude -> validador -> referência -> registro.
import { roteirizarComClaude } from "./claude.js";
import { validar } from "./validador.js";
import { custoReferencia } from "./custo.js";
import { montarRegistro } from "./registro.js";

export async function executarRoteirizacao({ cenario, rotulo, origem }, client, dados) {
  const resultado = await roteirizarComClaude({ ...dados, cenario }, client);
  return registroDeResultado({ cenario, rotulo, origem, resultado }, dados);
}

export function registroDeResultado({ cenario, rotulo, origem, resultado }, dados) {
  const validado = validar(resultado, cenario, dados);
  // A referência considera só os pedidos que a IA de fato enviou: comparação justa, sem saving inflado por pedidos não alocados.
  const enviados = new Set(validado.envios.flatMap((e) => e.pedidos));
  const referencia = custoReferencia(cenario.pedidos.filter((p) => enviados.has(p.id)), dados.frota, dados.transportadoras);
  return montarRegistro({
    rotulo: rotulo ?? cenario.rotulo,
    origem,
    data: cenario.data_envio,
    cenario_id: cenario.id,
    pedidos: cenario.pedidos,
    validado,
    referencia,
    resultado,
  });
}
