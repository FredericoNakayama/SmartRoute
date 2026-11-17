// Leitura e validação do CSV de pedidos. Roda no navegador e nos testes (ES module, sem dependências).

export const COLUNAS = [
  "id", "cliente", "cidade", "uf", "peso_kg", "paletes",
  "data_limite_entrega", "restricao_veiculo", "aceita_fracionado",
];

export const CIDADES_VALIDAS = [
  "Rio de Janeiro-RJ", "Niterói-RJ", "Petrópolis-RJ", "Volta Redonda-RJ", "Resende-RJ",
  "Porto Alegre-RS", "Canoas-RS", "Caxias do Sul-RS", "Santa Maria-RS", "Pelotas-RS",
];

const VEICULOS = ["VUC", "Toco", "Truck", "Carreta"];
const SIM = ["sim", "true", "1", "s"];
const NAO = ["não", "nao", "false", "0", "n"];

function numero(texto) {
  const limpo = texto.trim().replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", ".");
  return limpo === "" ? NaN : Number(limpo);
}

function data(texto) {
  const t = texto.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * @returns {{pedidos: object[], erros: {linha: number, mensagem: string}[]}}
 */
export function parseCsvPedidos(texto, cidadesValidas = CIDADES_VALIDAS, maxPedidos = 60) {
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const separador = (linhas[0] ?? "").includes(";") ? ";" : ",";
  const cabecalho = (linhas[0] ?? "").split(separador).map((c) => c.trim().toLowerCase());
  const faltando = COLUNAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length) {
    return { pedidos: [], erros: [{ linha: 1, mensagem: `Colunas faltando: ${faltando.join(", ")}` }] };
  }

  const pedidos = [];
  const erros = [];
  const ids = new Set();

  linhas.slice(1).forEach((bruta, i) => {
    const linha = i + 2;
    if (!bruta.trim()) return;
    const valores = bruta.split(separador);
    const campo = (nome) => (valores[cabecalho.indexOf(nome)] ?? "").trim();
    const problemas = [];

    const id = campo("id");
    if (!id) problemas.push("id vazio");
    else if (ids.has(id)) problemas.push(`id ${id} repetido`);
    const uf = campo("uf").toUpperCase();
    const cidade = campo("cidade");
    if (!["RJ", "RS"].includes(uf)) problemas.push(`UF "${campo("uf")}" inválida (use RJ ou RS)`);
    else if (!cidadesValidas.includes(`${cidade}-${uf}`)) problemas.push(`cidade "${cidade}-${uf}" não atendida`);
    const peso_kg = numero(campo("peso_kg"));
    if (!(peso_kg > 0)) problemas.push(`peso_kg "${campo("peso_kg")}" inválido`);
    const paletes = numero(campo("paletes"));
    if (!(Number.isInteger(paletes) && paletes > 0)) problemas.push(`paletes "${campo("paletes")}" deve ser inteiro positivo`);
    const data_limite_entrega = data(campo("data_limite_entrega"));
    if (!data_limite_entrega) problemas.push(`data "${campo("data_limite_entrega")}" inválida (use AAAA-MM-DD ou DD/MM/AAAA)`);
    const restricaoBruta = campo("restricao_veiculo");
    const restricao_veiculo = VEICULOS.find((v) => v.toLowerCase() === restricaoBruta.toLowerCase()) ?? "";
    if (restricaoBruta && !restricao_veiculo) problemas.push(`restricao_veiculo "${restricaoBruta}" inválida`);
    const fracBruto = campo("aceita_fracionado").toLowerCase();
    if (![...SIM, ...NAO].includes(fracBruto)) problemas.push(`aceita_fracionado "${campo("aceita_fracionado")}" inválido (use sim ou não)`);

    if (problemas.length) {
      erros.push({ linha, mensagem: problemas.join("; ") });
      return;
    }
    ids.add(id);
    pedidos.push({
      id, cliente: campo("cliente"), cidade, uf, peso_kg, paletes,
      data_limite_entrega, restricao_veiculo, aceita_fracionado: SIM.includes(fracBruto),
    });
  });

  if (pedidos.length + erros.length > maxPedidos) {
    erros.push({ linha: 1, mensagem: `O arquivo tem mais de ${maxPedidos} pedidos (máximo ${maxPedidos} pedidos por roteirização).` });
  }
  return { pedidos, erros };
}
