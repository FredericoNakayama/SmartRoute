import { readFileSync } from "node:fs";
import frota from "../data/frota.json" with { type: "json" };
import cidades from "../data/cidades.json" with { type: "json" };
import transportadoras from "../data/transportadoras.json" with { type: "json" };
import parametros from "../data/parametros.json" with { type: "json" };

const spec = readFileSync(new URL("../spec/regras.md", import.meta.url), "utf8");

/** Dados fixos do domínio: frota, cidades, transportadoras, parâmetros e a spec de regras. */
export function carregarDados() {
  return { frota, cidades, transportadoras, parametros, spec };
}
