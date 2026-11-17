// Transforma uma roteirização validada no registro guardado no histórico (MockAPI).

const arred = (n, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

export function montarRegistro({ rotulo, origem, data, cenario_id = null, pedidos, validado, referencia, resultado }) {
  const { envios, violacoes, custo_total } = validado;
  const lotacoes = envios.filter((e) => e.modalidade === "lotacao");
  const paletes = envios.reduce((s, e) => s + e.paletes, 0);

  const mix_veiculos = { VUC: 0, Toco: 0, Truck: 0, Carreta: 0, Fracionado: 0 };
  for (const e of envios) {
    if (e.modalidade === "lotacao" && e.veiculo in mix_veiculos) mix_veiculos[e.veiculo] += 1;
    if (e.modalidade === "fracionado") mix_veiculos.Fracionado += e.pedidos.length;
  }

  const custo_por_transportadora = { T1: 0, T2: 0, T3: 0 };
  for (const e of envios) {
    if (e.transportadora in custo_por_transportadora && e.custo != null) custo_por_transportadora[e.transportadora] += e.custo;
  }

  const ocupacoes = lotacoes.map((e) => e.ocupacao_kg).filter((x) => x != null);

  return {
    data,
    rotulo,
    origem,
    cenario_id,
    n_pedidos: pedidos.length,
    n_envios: envios.length,
    paletes_total: paletes,
    custo_total,
    custo_referencia: referencia.custo,
    saving_pct: referencia.custo > 0 ? arred(100 * (1 - custo_total / referencia.custo), 1) : 0,
    custo_por_palete: paletes > 0 ? arred(custo_total / paletes) : 0,
    ocupacao_media: ocupacoes.length ? Math.round(ocupacoes.reduce((s, x) => s + x, 0) / ocupacoes.length) : 0,
    mix_veiculos,
    custo_por_transportadora,
    n_violacoes: violacoes.length,
    violacoes,
    envios,
    nao_alocados: resultado.nao_alocados ?? [],
    resumo: resultado.resumo ?? "",
  };
}
