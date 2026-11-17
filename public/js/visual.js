// Funções de exibição compartilhadas entre o roteirizador e o dashboard (ES module, sem dependências).

const NOMES = { T1: "Alfa Cargas", T2: "Rota Sul Logística", T3: "Expressa Brasil" };

export function esc(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function brl(valor) {
  return Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export const nomeTransportadora = (id) => NOMES[id] ?? id;

function kpi(rotulo, valor, destaque = false) {
  return `<div class="col-6 col-lg"><div class="kpi ${destaque ? "destaque" : ""}"><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div></div></div>`;
}

function cardEnvio(e, i, violacoes) {
  const fr = e.modalidade === "fracionado";
  const titulo = fr ? `Fracionado (LTL)` : `Lotação (FTL) · ${esc(e.veiculo)}`;
  const problemas = violacoes.filter((v) => v.envio_index === i);
  const ocupacao = e.ocupacao_kg != null
    ? `<div class="progress mt-2" style="height:6px" title="Ocupação por peso"><div class="progress-bar bg-success" style="width:${Math.min(100, Number(e.ocupacao_kg) || 0)}%"></div></div>
       <div class="small text-muted">${e.ocupacao_kg}% da capacidade de peso</div>`
    : "";
  return `
    <div class="col-md-6"><div class="card envio ${fr ? "fracionado" : ""} h-100"><div class="card-body">
      <div class="d-flex justify-content-between">
        <div><div class="fw-semibold">${titulo} → ${esc(e.uf)}</div>
          <div class="small text-muted">${esc(nomeTransportadora(e.transportadora))} (${esc(e.transportadora)})</div></div>
        <div class="text-end"><div class="fw-bold">${e.custo == null ? "—" : brl(e.custo)}</div>
          <div class="small text-muted">${Number(e.paletes)} pal · ${Number(e.peso_kg).toLocaleString("pt-BR")} kg</div></div>
      </div>
      <div class="small mt-2"><i class="bi bi-box-seam"></i> ${e.pedidos.map(esc).join(", ")}</div>
      ${ocupacao}
      <p class="justificativa mt-2 mb-0"><i class="bi bi-chat-left-quote"></i> ${esc(e.justificativa)}</p>
      ${problemas.map((v) => `<div class="alert alert-danger py-1 px-2 small mt-2 mb-0"><strong>${esc(v.regra)}</strong> — ${esc(v.mensagem)}</div>`).join("")}
    </div></div></div>`;
}

/** Painel completo de uma roteirização: indicadores, envios, violações, não alocados e resumo da IA. */
export function painelResultado(r) {
  const gerais = r.violacoes.filter((v) => v.envio_index == null);
  const violacoesHtml = r.violacoes.length
    ? `<div class="alert alert-danger"><strong><i class="bi bi-exclamation-triangle"></i> O validador encontrou ${r.violacoes.length} violação(ões) de regra.</strong>
       ${gerais.length ? `<ul class="mb-0 mt-1">${gerais.map((v) => `<li><strong>${esc(v.regra)}</strong> — ${esc(v.mensagem)}</li>`).join("")}</ul>` : ""}</div>`
    : `<div class="alert alert-success"><i class="bi bi-shield-check"></i> O validador conferiu as regras R1–R10: nenhuma violação.</div>`;
  const naoAlocados = r.nao_alocados.length
    ? `<h3 class="h6 mt-4">Pedidos não alocados</h3><ul>${r.nao_alocados.map((n) => `<li><strong>${esc(n.pedido_id)}</strong>: ${esc(n.motivo)}</li>`).join("")}</ul>`
    : "";
  return `
    <div class="row g-3 mb-3">
      ${kpi("Custo da IA", brl(r.custo_total))}
      ${kpi("Sem otimização", brl(r.custo_referencia))}
      ${kpi("Saving", `${Number(r.saving_pct).toLocaleString("pt-BR")}%`, true)}
      ${kpi("Envios", Number(r.n_envios))}
      ${kpi("Ocupação média", `${Number(r.ocupacao_media)}%`)}
    </div>
    <div class="card mb-3"><div class="card-body"><i class="bi bi-stars"></i> <strong>Resumo da IA:</strong> ${esc(r.resumo)}</div></div>
    ${violacoesHtml}
    <div class="row g-3">${r.envios.map((e, i) => cardEnvio(e, i, r.violacoes)).join("")}</div>
    ${naoAlocados}
    <p class="small text-muted mt-3">"Sem otimização" = cada pedido num veículo dedicado, o menor que atende, na transportadora mais barata para ele.</p>`;
}
