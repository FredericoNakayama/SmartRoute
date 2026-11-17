import { esc, brl, painelResultado } from "./visual.js";

const CORES = { VUC: "#c8a27a", Toco: "#a0714f", Truck: "#6f4a33", Carreta: "#3b2417", Fracionado: "#d9b43a" };
const ORIGEM = { historico: "Histórico", cenario: "Cenário pronto", csv: "CSV enviado" };
const pct = (n) => `${Number(n).toLocaleString("pt-BR")}%`;
const media = (lista) => (lista.length ? lista.reduce((s, x) => s + x, 0) / lista.length : 0);
let registros = [];

async function iniciar() {
  try {
    const resp = await fetch("/api/historico");
    const corpo = await resp.json();
    registros = corpo.registros ?? [];
    document.getElementById("fonte").innerHTML = corpo.fonte === "local"
      ? `<span class="badge text-bg-secondary" title="O MockAPI está indisponível; exibindo a cópia local do histórico">Dados locais</span>`
      : `<span class="badge text-bg-success"><i class="bi bi-cloud-check"></i> MockAPI</span>`;
  } catch {
    registros = [];
  }
  document.getElementById("carregando").classList.add("d-none");
  if (!registros.length) return document.getElementById("vazio").classList.remove("d-none");
  document.getElementById("conteudo").classList.remove("d-none");
  kpis();
  graficos();
  tabela();
  seletores();
}

function kpis() {
  const total = registros.reduce((s, r) => s + r.custo_total, 0);
  const ref = registros.reduce((s, r) => s + r.custo_referencia, 0);
  const caixa = (rotulo, valor, destaque = false) =>
    `<div class="col-6 col-lg"><div class="kpi ${destaque ? "destaque" : ""}"><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div></div></div>`;
  document.getElementById("kpis").innerHTML = [
    caixa("Roteirizações", registros.length),
    caixa("Custo total (IA)", brl(total)),
    caixa("Economia vs. sem otimização", brl(ref - total), true),
    caixa("Saving médio", pct(Math.round(media(registros.map((r) => r.saving_pct)) * 10) / 10), true),
    caixa("Custo médio por palete", brl(media(registros.map((r) => r.custo_por_palete)))),
    caixa("Ocupação média", pct(Math.round(media(registros.map((r) => r.ocupacao_media))))),
  ].join("");
}

function graficos() {
  const rotulos = registros.map((r) => r.rotulo);
  const moeda = { ticks: { callback: (v) => brl(v) } };
  new Chart(document.getElementById("g-custo"), {
    type: "line",
    data: {
      labels: rotulos,
      datasets: [
        { label: "Custo da IA", data: registros.map((r) => r.custo_total), borderColor: "#4b2e1e", backgroundColor: "#4b2e1e", tension: 0.2 },
        { label: "Sem otimização", data: registros.map((r) => r.custo_referencia), borderColor: "#b9a597", backgroundColor: "#b9a597", borderDash: [6, 4], tension: 0.2 },
      ],
    },
    options: { scales: { y: moeda }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${brl(c.parsed.y)}` } } } },
  });
  new Chart(document.getElementById("g-palete"), {
    type: "bar",
    data: { labels: rotulos, datasets: [{ label: "R$ por palete", data: registros.map((r) => r.custo_por_palete), backgroundColor: "#8a5a3c" }] },
    options: { indexAxis: "y", scales: { x: moeda, y: { ticks: { autoSkip: false } } }, plugins: { legend: { display: false } } },
  });
  new Chart(document.getElementById("g-mix"), {
    type: "bar",
    data: {
      labels: rotulos,
      datasets: Object.keys(CORES).map((tipo) => ({
        label: tipo === "Fracionado" ? "Pedidos em fracionado" : `Lotações de ${tipo}`,
        data: registros.map((r) => r.mix_veiculos?.[tipo] ?? 0),
        backgroundColor: CORES[tipo],
      })),
    },
    options: { scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } } },
  });
}

function tabela() {
  document.getElementById("tabela").innerHTML = registros.map((r, i) => `
    <tr role="button" data-i="${i}">
      <td>${esc(r.rotulo)}</td><td>${esc(r.data)}</td><td>${ORIGEM[r.origem] ?? esc(r.origem)}</td>
      <td class="text-end">${r.n_pedidos}</td><td class="text-end">${r.n_envios}</td><td class="text-end">${brl(r.custo_total)}</td>
      <td class="text-end text-success fw-semibold">${pct(r.saving_pct)}</td><td class="text-end">${pct(r.ocupacao_media)}</td>
      <td class="text-end">${r.n_violacoes ? `<span class="badge text-bg-danger">${r.n_violacoes}</span>` : `<i class="bi bi-check-circle text-success"></i>`}</td>
    </tr>`).join("");
  const modal = new bootstrap.Modal(document.getElementById("modal"));
  document.getElementById("tabela").addEventListener("click", (ev) => {
    const linha = ev.target.closest("tr[data-i]");
    if (!linha) return;
    const r = registros[Number(linha.dataset.i)];
    document.getElementById("modal-titulo").textContent = `${r.rotulo} — ${r.data}`;
    document.getElementById("modal-corpo").innerHTML = painelResultado(r);
    modal.show();
  });
}

function seletores() {
  const opcoes = registros.map((r) => `<option value="${esc(r.id)}">${esc(r.rotulo)} — ${brl(r.custo_total)}</option>`).join("");
  const a = document.getElementById("sel-a");
  const b = document.getElementById("sel-b");
  a.innerHTML = b.innerHTML = opcoes;
  // Par padrão com explicação pronta no modo demonstração: Semana 04 (pico) × Semana 03
  const achar = (texto) => registros.find((r) => r.rotulo.startsWith(texto));
  const padraoA = achar("Semana 04") ?? registros.at(-1);
  const padraoB = achar("Semana 03") ?? registros.at(-2) ?? registros[0];
  a.value = padraoA.id;
  b.value = padraoB.id;
  document.getElementById("btn-comparar").addEventListener("click", comparar);
}

async function comparar() {
  const btn = document.getElementById("btn-comparar");
  const saida = document.getElementById("comparacao");
  const idA = document.getElementById("sel-a").value;
  const idB = document.getElementById("sel-b").value;
  if (idA === idB) {
    saida.innerHTML = `<div class="alert alert-warning">Escolha duas roteirizações diferentes.</div>`;
    return;
  }
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
  saida.innerHTML = `<div class="text-muted small">A IA está analisando as duas roteirizações…</div>`;
  try {
    const resp = await fetch("/api/comparar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idA, idB }) });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      saida.innerHTML = `<div class="alert alert-warning"><i class="bi bi-info-circle"></i> ${esc(corpo.erro ?? "Não foi possível comparar agora.")}</div>`;
      return;
    }
    const regA = registros.find((r) => String(r.id) === idA);
    const regB = registros.find((r) => String(r.id) === idB);
    saida.innerHTML = explicacao(corpo, regA, regB);
  } catch {
    saida.innerHTML = `<div class="alert alert-danger">Falha de conexão. Tente novamente.</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-search"></i> Explicar`;
  }
}

function explicacao({ modo, explicacao: texto, fatores, aviso }, a, b) {
  const linhas = [
    ["Pedidos", a.n_pedidos, b.n_pedidos],
    ["Paletes", a.paletes_total, b.paletes_total],
    ["Envios", a.n_envios, b.n_envios],
    ["Pedidos em fracionado", a.mix_veiculos?.Fracionado ?? 0, b.mix_veiculos?.Fracionado ?? 0],
    ["Ocupação média", pct(a.ocupacao_media), pct(b.ocupacao_media)],
    ["Custo por palete", brl(a.custo_por_palete), brl(b.custo_por_palete)],
    ["Custo total", brl(a.custo_total), brl(b.custo_total)],
  ];
  const selo = modo === "ao_vivo"
    ? `<span class="badge text-bg-success selo">IA ao vivo</span>`
    : `<span class="badge text-bg-secondary selo">Demonstração (explicação pré-gerada pela IA)</span>`;
  return `
    <div class="row g-3">
      <div class="col-lg-8">
        <div class="mb-2">${selo}</div>
        ${aviso ? `<div class="small text-muted mb-2">${esc(aviso)}</div>` : ""}
        ${String(texto).split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}
        <ul class="list-unstyled">${fatores.map((f) => `
          <li class="mb-1"><i class="bi ${f.impacto === "aumentou" ? "bi-arrow-up-circle-fill text-danger" : "bi-arrow-down-circle-fill text-success"}"></i>
            <strong>${esc(f.fator)}</strong> — ${esc(f.detalhe)}</li>`).join("")}</ul>
      </div>
      <div class="col-lg-4">
        <table class="table table-sm small"><thead><tr><th></th><th>A</th><th>B</th></tr></thead><tbody>
          ${linhas.map(([n, x, y]) => `<tr><td>${n}</td><td>${x}</td><td>${y}</td></tr>`).join("")}
        </tbody></table>
        <div class="small text-muted">A = ${esc(a.rotulo)} · B = ${esc(b.rotulo)}</div>
      </div>
    </div>`;
}

iniciar();
