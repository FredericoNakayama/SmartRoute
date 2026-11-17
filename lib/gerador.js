// Gerador determinístico de cenários fictícios (mesma seed => mesmo cenário).

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function somarDias(dataIso, dias) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const VEICULOS_PADRAO = { VUC: 2, Toco: 2, Truck: 2, Carreta: 2 };
const FRACIONADO_PADRAO = { RJ: 10, RS: 8 };

/**
 * Gera um cenário (um dia de envio): pedidos + disponibilidade das transportadoras.
 * @param {object} cfg {id, rotulo, seed, n, data_envio, pctRJ, pctRestricao, pctDedicado, paletesMedio, indisponiveis?, fatorFracionado?}
 * @param {object} dados resultado de carregarDados()
 */
export function gerarCenario(cfg, dados) {
  const rnd = mulberry32(cfg.seed);
  const escolher = (lista) => lista[Math.floor(rnd() * lista.length)];
  const cidadesRJ = dados.cidades.filter((c) => c.endsWith("-RJ"));
  const cidadesRS = dados.cidades.filter((c) => c.endsWith("-RS"));

  const pedidos = [];
  for (let i = 1; i <= cfg.n; i++) {
    const chave = escolher(rnd() < cfg.pctRJ ? cidadesRJ : cidadesRS);
    const [cidade, uf] = [chave.slice(0, -3), chave.slice(-2)];
    const paletes = Math.max(1, Math.min(14, Math.round(cfg.paletesMedio * (0.4 + rnd() * 1.2))));
    const peso_kg = Math.round(paletes * (700 + rnd() * 250));
    const prazoMin = uf === "RJ" ? 1 : 2;
    const restricao_veiculo = rnd() < cfg.pctRestricao ? escolher(["VUC", "Toco", "Toco", "Truck"]) : "";
    pedidos.push({
      id: `P${String(i).padStart(3, "0")}`,
      cliente: `Cliente Fictício ${String(1 + Math.floor(rnd() * 40)).padStart(2, "0")}`,
      cidade,
      uf,
      peso_kg,
      paletes,
      data_limite_entrega: somarDias(cfg.data_envio, prazoMin + Math.floor(rnd() * 6)),
      restricao_veiculo,
      aceita_fracionado: rnd() >= cfg.pctDedicado,
    });
  }

  const fator = cfg.fatorFracionado ?? 1;
  const disponibilidade = {};
  for (const t of dados.transportadoras) {
    const veiculos = { ...VEICULOS_PADRAO };
    for (const ind of cfg.indisponiveis ?? []) {
      if (ind.transportadora === t.id) veiculos[ind.tipo] = 0;
    }
    disponibilidade[t.id] = {
      veiculos,
      fracionado_paletes: {
        RJ: Math.round(FRACIONADO_PADRAO.RJ * fator),
        RS: Math.round(FRACIONADO_PADRAO.RS * fator),
      },
    };
  }

  return { id: cfg.id, rotulo: cfg.rotulo, data_envio: cfg.data_envio, disponibilidade, pedidos };
}
