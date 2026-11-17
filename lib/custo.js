// Custos calculados a partir das tabelas das transportadoras (nunca a partir de números vindos da IA).

export const TAMANHO = { VUC: 0, Toco: 1, Truck: 2, Carreta: 3 };

/** O cliente aceita este tipo de veículo? Restrição vazia = aceita qualquer um. */
export function veiculoPermitido(tipo, restricao) {
  return !restricao || TAMANHO[tipo] <= TAMANHO[restricao];
}

/** Custo de um envio, ou null se a transportadora não opera essa combinação. */
export function custoEnvio(envio, pedidosById, transportadoras) {
  const t = transportadoras.find((x) => x.id === envio.transportadora);
  if (!t) return null;
  const pedidos = envio.pedidos.map((id) => pedidosById[id]).filter(Boolean);

  if (envio.modalidade === "lotacao") {
    const preco = t.lotacao[envio.uf]?.precos[envio.veiculo];
    if (preco == null) return null;
    const cidades = new Set(pedidos.map((p) => p.cidade));
    return preco + t.adicional_parada * Math.max(0, cidades.size - 1);
  }
  if (envio.modalidade === "fracionado") {
    const tab = t.fracionado[envio.uf];
    if (!tab) return null;
    return pedidos.reduce((soma, p) => soma + Math.max(tab.preco_palete * p.paletes, tab.minimo), 0);
  }
  return null;
}

/** Menor veículo da frota que comporta o pedido e que o cliente aceita. */
export function menorVeiculoQueAtende(pedido, frota) {
  return (
    frota.find(
      (v) =>
        v.capacidade_kg >= pedido.peso_kg &&
        v.capacidade_paletes >= pedido.paletes &&
        veiculoPermitido(v.tipo, pedido.restricao_veiculo),
    ) ?? null
  );
}

/**
 * Referência "sem otimização": cada pedido em lotação dedicada, no menor veículo que o atende
 * e que alguma transportadora opera na UF, pela transportadora mais barata (ignora disponibilidade).
 */
export function custoReferencia(pedidos, frota, transportadoras) {
  let custo = 0;
  const nao_atendiveis = [];
  for (const p of pedidos) {
    let melhor = null;
    for (const v of frota) {
      if (v.capacidade_kg < p.peso_kg || v.capacidade_paletes < p.paletes) continue;
      if (!veiculoPermitido(v.tipo, p.restricao_veiculo)) continue;
      const precos = transportadoras.map((t) => t.lotacao[p.uf]?.precos[v.tipo]).filter((x) => x != null);
      if (precos.length) {
        melhor = Math.min(...precos);
        break;
      }
    }
    if (melhor == null) nao_atendiveis.push(p.id);
    else custo += melhor;
  }
  return { custo, nao_atendiveis };
}
