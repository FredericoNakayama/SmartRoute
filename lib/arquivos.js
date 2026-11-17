// Leitura de arquivos JSON de data/ (cenários, resultados de demonstração, histórico local, comparações prontas).
import { readFile } from "node:fs/promises";

export async function lerJson(caminhoRelativo, padrao = null) {
  try {
    return JSON.parse(await readFile(new URL(`../data/${caminhoRelativo}`, import.meta.url), "utf8"));
  } catch {
    return padrao;
  }
}

/** Histórico do MockAPI (ordenado por data); se falhar ou vier vazio, usa a cópia local. */
export async function obterHistorico(listarRegistros) {
  try {
    const registros = await listarRegistros();
    if (Array.isArray(registros) && registros.length) {
      return { fonte: "mockapi", registros: registros.sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? ""))) };
    }
  } catch {
    // cai no histórico local
  }
  const locais = await lerJson("historico.json", []);
  return { fonte: "local", registros: locais.sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? ""))) };
}

export function ipDe(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function lerCorpo(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
