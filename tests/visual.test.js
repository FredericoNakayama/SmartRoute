import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, brl, painelResultado } from "../public/js/visual.js";

test("esc neutraliza HTML vindo do CSV ou da IA", () => {
  assert.equal(esc(`<img src=x onerror="alert(1)">&'`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;");
  assert.equal(esc(null), "");
});

test("brl formata em reais", () => {
  assert.match(brl(3450), /R\$\s?3\.450/);
});

test("painelResultado escapa justificativa e mostra violações", () => {
  const r = {
    custo_total: 1000, custo_referencia: 2000, saving_pct: 50, n_envios: 1, ocupacao_media: 60, n_pedidos: 1,
    envios: [{ modalidade: "lotacao", transportadora: "T1", veiculo: "Truck", uf: "RJ", pedidos: ["P1"], paletes: 2, peso_kg: 1600, ocupacao_kg: 13, custo: 1000, justificativa: "<script>x</script>" }],
    violacoes: [{ regra: "R7_prazo", mensagem: "Pedido P1 atrasa", envio_index: 0, pedido_id: "P1" }],
    nao_alocados: [], resumo: "ok",
  };
  const html = painelResultado(r);
  assert.ok(!html.includes("<script>x"));
  assert.match(html, /R7_prazo/);
  assert.match(html, /50/);
});
