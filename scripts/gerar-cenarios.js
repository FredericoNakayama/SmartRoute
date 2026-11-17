// Gera os cenários de demonstração, as 12 semanas do histórico e o CSV modelo.
// Uso: node scripts/gerar-cenarios.js
import { mkdirSync, writeFileSync } from "node:fs";
import { gerarCenario } from "../lib/gerador.js";
import { carregarDados } from "../lib/dados.js";

const dados = carregarDados();
const padrao = { pctRJ: 0.5, pctRestricao: 0.15, pctDedicado: 0.15, paletesMedio: 3.5 };

const cenarios = [
  { id: "cenario-1", rotulo: "Semana típica", seed: 101, n: 25, data_envio: "2026-11-16" },
  { id: "cenario-2", rotulo: "Pico de fim de mês", seed: 202, n: 55, data_envio: "2026-11-30" },
  { id: "cenario-3", rotulo: "Muitos clientes com restrição de veículo", seed: 303, n: 25, data_envio: "2026-11-23",
    pctRestricao: 0.45, indisponiveis: [{ transportadora: "T1", tipo: "Carreta" }] },
];

const variacoes = {
  4: { n: 55, rotulo: "Semana 04 — pico de pedidos" },
  6: { pctRestricao: 0.5, rotulo: "Semana 06 — muitos clientes com restrição" },
  7: { indisponiveis: [{ transportadora: "T1", tipo: "Carreta" }, { transportadora: "T2", tipo: "Carreta" }], rotulo: "Semana 07 — Carretas indisponíveis" },
  8: { n: 50, pctRJ: 0.3, rotulo: "Semana 08 — pico com mais RS" },
  9: { fatorFracionado: 0.3, rotulo: "Semana 09 — pouco espaço fracionado" },
  10: { paletesMedio: 1.5, rotulo: "Semana 10 — pedidos pequenos" },
};

const semanas = [];
for (let s = 1; s <= 12; s++) {
  const d = new Date(Date.UTC(2026, 7, 3 + (s - 1) * 7)); // segundas-feiras a partir de 03/08/2026
  semanas.push({
    id: `semana-${String(s).padStart(2, "0")}`,
    rotulo: `Semana ${String(s).padStart(2, "0")}`,
    seed: 1000 + s,
    n: 30,
    data_envio: d.toISOString().slice(0, 10),
    ...variacoes[s],
  });
}

function salvar(pasta, cfg) {
  mkdirSync(pasta, { recursive: true });
  const cenario = gerarCenario({ ...padrao, ...cfg }, dados);
  writeFileSync(`${pasta}/${cfg.id}.json`, JSON.stringify(cenario, null, 2) + "\n");
  console.log(`${pasta}/${cfg.id}.json — ${cenario.pedidos.length} pedidos`);
}

cenarios.forEach((c) => salvar("data/cenarios", c));
semanas.forEach((s) => salvar("data/semanas", s));

writeFileSync(
  "public/modelo-pedidos.csv",
  [
    "id,cliente,cidade,uf,peso_kg,paletes,data_limite_entrega,restricao_veiculo,aceita_fracionado",
    "P001,Cliente Exemplo 01,Rio de Janeiro,RJ,2400,3,2026-11-20,,sim",
    "P002,Cliente Exemplo 02,Niterói,RJ,800,1,2026-11-19,VUC,sim",
    "P003,Cliente Exemplo 03,Porto Alegre,RS,9600,12,2026-11-24,,não",
  ].join("\n") + "\n",
);
console.log("public/modelo-pedidos.csv");
