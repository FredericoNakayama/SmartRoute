// Confere em código cada regra verificável da spec (spec/regras.md) sobre a resposta da IA.
import { custoEnvio, veiculoPermitido } from "./custo.js";

function somarDias(dataIso, dias) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * @returns {{envios: object[], violacoes: {regra, mensagem, envio_index, pedido_id}[], custo_total: number}}
 */
export function validar(resultado, cenario, dados) {
  const { frota, transportadoras, parametros } = dados;
  const pedidosById = Object.fromEntries(cenario.pedidos.map((p) => [p.id, p]));
  const violacoes = [];
  const add = (regra, mensagem, envio_index = null, pedido_id = null) =>
    violacoes.push({ regra, mensagem, envio_index, pedido_id });

  const vistos = new Set();
  const marcar = (id, envio_index) => {
    if (!pedidosById[id]) return add("R1_inexistente", `Pedido ${id} não existe no cenário.`, envio_index, id);
    if (vistos.has(id)) return add("R1_duplicado", `Pedido ${id} aparece mais de uma vez.`, envio_index, id);
    vistos.add(id);
  };

  const usoVeiculos = {}; // "T1|Truck" -> n
  const usoFracionado = {}; // "T1|RJ" -> paletes
  let custo_total = 0;

  const envios = (resultado.envios ?? []).map((envio, i) => {
    envio.pedidos.forEach((id) => marcar(id, i));
    const pedidos = envio.pedidos.map((id) => pedidosById[id]).filter(Boolean);
    const peso_kg = pedidos.reduce((s, p) => s + p.peso_kg, 0);
    const paletes = pedidos.reduce((s, p) => s + p.paletes, 0);
    const t = transportadoras.find((x) => x.id === envio.transportadora);
    const custo = custoEnvio(envio, pedidosById, transportadoras);
    let ocupacao_kg = null;

    if (custo == null) {
      add("R5_combinacao_invalida", `A transportadora ${envio.transportadora} não opera ${envio.modalidade} ${envio.veiculo ?? ""} para ${envio.uf}.`, i);
    } else {
      custo_total += custo;
    }

    for (const p of pedidos) {
      if (p.uf !== envio.uf) add("R8_mistura_uf", `Pedido ${p.id} é de ${p.uf}, mas o envio vai para ${envio.uf}.`, i, p.id);
    }

    let veiculoEntrega = null;
    let prazo = null;
    if (envio.modalidade === "lotacao") {
      const v = frota.find((x) => x.tipo === envio.veiculo);
      veiculoEntrega = v?.tipo ?? null;
      prazo = t?.lotacao[envio.uf]?.prazo_dias ?? null;
      if (v) {
        ocupacao_kg = Math.round((peso_kg / v.capacidade_kg) * 100);
        if (peso_kg > v.capacidade_kg) add("R2_capacidade_kg", `${peso_kg} kg excedem os ${v.capacidade_kg} kg do ${v.tipo}.`, i);
        if (paletes > v.capacidade_paletes) add("R2_capacidade_paletes", `${paletes} paletes excedem os ${v.capacidade_paletes} do ${v.tipo}.`, i);
        const chave = `${envio.transportadora}|${v.tipo}`;
        usoVeiculos[chave] = (usoVeiculos[chave] ?? 0) + 1;
      }
      const cidades = new Set(pedidos.map((p) => p.cidade));
      if (cidades.size > parametros.max_paradas) add("R9_max_paradas", `${cidades.size} cidades na rota (máximo ${parametros.max_paradas}).`, i);
    } else if (envio.modalidade === "fracionado") {
      veiculoEntrega = t?.fracionado.veiculo_entrega ?? null;
      prazo = t?.fracionado[envio.uf]?.prazo_dias ?? null;
      const chave = `${envio.transportadora}|${envio.uf}`;
      usoFracionado[chave] = (usoFracionado[chave] ?? 0) + paletes;
      for (const p of pedidos) {
        if (!p.aceita_fracionado) add("R10_exige_dedicado", `Pedido ${p.id} exige carga dedicada e foi para fracionado.`, i, p.id);
      }
    }

    for (const p of pedidos) {
      if (veiculoEntrega && !veiculoPermitido(veiculoEntrega, p.restricao_veiculo)) {
        add("R6_restricao_veiculo", `${p.cliente} (pedido ${p.id}) só recebe até ${p.restricao_veiculo}; o envio usa ${veiculoEntrega}.`, i, p.id);
      }
      if (prazo != null && somarDias(cenario.data_envio, prazo) > p.data_limite_entrega) {
        add("R7_prazo", `Pedido ${p.id} chegaria em ${somarDias(cenario.data_envio, prazo)}, depois do limite ${p.data_limite_entrega}.`, i, p.id);
      }
    }

    return { ...envio, peso_kg, paletes, ocupacao_kg, custo };
  });

  for (const na of resultado.nao_alocados ?? []) marcar(na.pedido_id, null);
  for (const p of cenario.pedidos) {
    if (!vistos.has(p.id)) add("R1_esquecido", `Pedido ${p.id} não foi enviado nem listado como não alocado.`, null, p.id);
  }

  for (const [chave, n] of Object.entries(usoVeiculos)) {
    const [tid, tipo] = chave.split("|");
    const livres = cenario.disponibilidade[tid]?.veiculos[tipo] ?? 0;
    if (n > livres) add("R4_disponibilidade", `${n} ${tipo} da ${tid} usados, mas só ${livres} disponíveis no dia.`);
  }
  for (const [chave, pal] of Object.entries(usoFracionado)) {
    const [tid, uf] = chave.split("|");
    const livre = cenario.disponibilidade[tid]?.fracionado_paletes[uf] ?? 0;
    if (pal > livre) add("R3_espaco_fracionado", `${pal} paletes em fracionado na ${tid} para ${uf}, mas só ${livre} de espaço no dia.`);
  }

  return { envios, violacoes, custo_total: Math.round(custo_total * 100) / 100 };
}
