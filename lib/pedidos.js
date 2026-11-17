// Pedidos vindos do navegador (CSV): o servidor reconstrói cada um só com os campos conhecidos,
// para não gravar texto arbitrário no histórico público nem inflar o custo da chamada à IA.

const VEICULOS = ["", "VUC", "Toco", "Truck", "Carreta"];

/** Pedido limpo, ou null se algum campo for inválido. */
export function sanitizarPedido(p, cidades) {
  if (!p || typeof p !== "object") return null;
  const ok =
    typeof p.id === "string" && /^[\w.-]{1,20}$/.test(p.id) &&
    typeof p.cliente === "string" &&
    ["RJ", "RS"].includes(p.uf) && cidades.includes(`${p.cidade}-${p.uf}`) &&
    typeof p.peso_kg === "number" && p.peso_kg > 0 && p.peso_kg <= 100000 &&
    Number.isInteger(p.paletes) && p.paletes > 0 && p.paletes <= 100 &&
    typeof p.data_limite_entrega === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.data_limite_entrega) &&
    VEICULOS.includes(p.restricao_veiculo ?? "") &&
    typeof p.aceita_fracionado === "boolean";
  if (!ok) return null;
  return {
    id: p.id,
    cliente: p.cliente.replace(/[<>]/g, "").slice(0, 60),
    cidade: p.cidade,
    uf: p.uf,
    peso_kg: p.peso_kg,
    paletes: p.paletes,
    data_limite_entrega: p.data_limite_entrega,
    restricao_veiculo: p.restricao_veiculo ?? "",
    aceita_fracionado: p.aceita_fracionado,
  };
}

/** Rótulo exibido no dashboard: só letras, números, espaço, ponto, hífen e sublinhado; até 40 caracteres. */
export function sanitizarRotulo(texto) {
  const limpo = String(texto ?? "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40);
  return limpo || "CSV enviado";
}
