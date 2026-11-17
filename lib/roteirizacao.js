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
  const referencia = custoReferencia(cenario.pedidos, dados.frota, dados.transportadoras);
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
