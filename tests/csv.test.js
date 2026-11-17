import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsvPedidos, COLUNAS, CIDADES_VALIDAS } from "../public/js/csv.js";
import cidades from "../data/cidades.json" with { type: "json" };

const CAB = COLUNAS.join(",");
const linha = "P001,Cliente 01,Rio de Janeiro,RJ,2400,3,2026-11-20,,sim";

test("CIDADES_VALIDAS bate com data/cidades.json", () => {
  assert.deepEqual([...CIDADES_VALIDAS].sort(), [...cidades].sort());
});

test("CSV com vírgula vira pedidos", () => {
  const r = parseCsvPedidos(`${CAB}\n${linha}\nP002,Cliente 02,Niterói,RJ,800,1,2026-11-19,VUC,não\n`);
  assert.deepEqual(r.erros, []);
  assert.deepEqual(r.pedidos[0], {
    id: "P001", cliente: "Cliente 01", cidade: "Rio de Janeiro", uf: "RJ", peso_kg: 2400, paletes: 3,
    data_limite_entrega: "2026-11-20", restricao_veiculo: "", aceita_fracionado: true,
  });
  assert.equal(r.pedidos[1].restricao_veiculo, "VUC");
  assert.equal(r.pedidos[1].aceita_fracionado, false);
});

test("CSV do Excel pt-BR: ponto e vírgula, vírgula decimal, BOM e data DD/MM/AAAA", () => {
  const texto = "﻿" + COLUNAS.join(";") + "\r\nP001;Cliente 01;Rio de Janeiro;RJ;2400,5;3;20/11/2026;;Sim\r\n";
  const r = parseCsvPedidos(texto);
  assert.deepEqual(r.erros, []);
  assert.equal(r.pedidos[0].peso_kg, 2400.5);
  assert.equal(r.pedidos[0].data_limite_entrega, "2026-11-20");
  assert.equal(r.pedidos[0].aceita_fracionado, true);
});

test("coluna faltando é erro na linha 1", () => {
  const r = parseCsvPedidos("id,cliente,cidade\nP001,C,Niterói\n");
  assert.equal(r.erros[0].linha, 1);
  assert.match(r.erros[0].mensagem, /uf/);
});

test("valores inválidos geram erro com o número da linha", () => {
  const r = parseCsvPedidos([CAB, linha,
    "P002,C,Niterói,RJ,abc,1,2026-11-19,,sim",
    "P003,C,Curitiba,PR,100,1,2026-11-19,,sim",
    "P004,C,Niterói,RJ,100,1,2026-11-19,Bitrem,sim",
    "P005,C,Niterói,RJ,100,1,amanhã,,talvez",
  ].join("\n"));
  const linhas = r.erros.map((e) => e.linha);
  assert.ok(linhas.includes(3) && linhas.includes(4) && linhas.includes(5) && linhas.includes(6));
  assert.ok(!linhas.includes(2));
});

test("linhas em branco são ignoradas e mais de 60 pedidos é erro", () => {
  assert.equal(parseCsvPedidos(`${CAB}\n\n${linha}\n\n`).pedidos.length, 1);
  const muitas = Array.from({ length: 61 }, (_, i) => linha.replace("P001", `P${i}`));
  const r = parseCsvPedidos([CAB, ...muitas].join("\n"));
  assert.ok(r.erros.some((e) => /60 pedidos/.test(e.mensagem)));
});

test("id repetido é erro", () => {
  const r = parseCsvPedidos([CAB, linha, linha].join("\n"));
  assert.ok(r.erros.some((e) => e.linha === 3 && /repetido/.test(e.mensagem)));
});
