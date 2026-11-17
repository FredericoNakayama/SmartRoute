import { parseCsvPedidos, decodificarArquivo } from "./csv.js";
import { esc, painelResultado } from "./visual.js";

const btn = document.getElementById("btn-roteirizar");
const status = document.getElementById("status");
const alerta = document.getElementById("alerta");
const resultado = document.getElementById("resultado");
let entrada = null; // {cenario: "cenario-1"} ou {pedidos: [...], rotulo}

function selecionarCenario(card) {
  document.querySelectorAll(".card-cenario").forEach((c) => c.classList.remove("selecionado"));
  card.classList.add("selecionado");
  entrada = { cenario: card.dataset.cenario };
  document.getElementById("arquivo").value = "";
  document.getElementById("csv-erros").innerHTML = "";
  document.getElementById("csv-previa").innerHTML = "";
  btn.disabled = false;
  status.innerHTML = `<strong>${esc(card.querySelector("h3").textContent.trim())}</strong> · demonstração: mostra o resultado gerado antes pelo Claude, <strong>sem chamar a API e sem custo</strong>.`;
}

document.querySelectorAll(".card-cenario").forEach((card) => card.addEventListener("click", () => selecionarCenario(card)));

// Link direto para um cenário: /?cenario=cenario-1 já mostra o resultado de demonstração (sem custo).
const cenarioDaUrl = new URLSearchParams(location.search).get("cenario");
const cardDaUrl = document.querySelector(`.card-cenario[data-cenario="${CSS.escape(cenarioDaUrl ?? "")}"]`);
if (cardDaUrl) {
  selecionarCenario(cardDaUrl);
  queueMicrotask(() => btn.click());
}

document.getElementById("arquivo").addEventListener("change", async (ev) => {
  const arquivo = ev.target.files[0];
  if (!arquivo) return;
  document.querySelectorAll(".card-cenario").forEach((c) => c.classList.remove("selecionado"));
  const { pedidos, erros } = parseCsvPedidos(decodificarArquivo(await arquivo.arrayBuffer()));

  document.getElementById("csv-erros").innerHTML = erros.length
    ? `<div class="alert alert-danger"><strong>Corrija o arquivo antes de roteirizar:</strong><ul class="mb-0">${erros
        .map((e) => `<li>Linha ${e.linha}: ${esc(e.mensagem)}</li>`).join("")}</ul></div>`
    : "";
  document.getElementById("csv-previa").innerHTML = pedidos.length
    ? `<div class="small text-muted mb-1">${pedidos.length} pedido(s) válidos</div>
       <div class="tabela-previa"><table class="table table-sm table-striped mb-0"><thead><tr>
       <th>ID</th><th>Cliente</th><th>Destino</th><th>Peso</th><th>Paletes</th><th>Limite</th><th>Restrição</th><th>Fracionado?</th></tr></thead><tbody>
       ${pedidos.map((p) => `<tr><td>${esc(p.id)}</td><td>${esc(p.cliente)}</td><td>${esc(p.cidade)}-${p.uf}</td><td>${p.peso_kg} kg</td>
         <td>${p.paletes}</td><td>${p.data_limite_entrega}</td><td>${p.restricao_veiculo || "—"}</td><td>${p.aceita_fracionado ? "sim" : "não"}</td></tr>`).join("")}
       </tbody></table></div>`
    : "";

  entrada = erros.length || !pedidos.length ? null : { pedidos, rotulo: arquivo.name.replace(/\.csv$/i, "") };
  btn.disabled = !entrada;
  status.innerHTML = entrada ? `<strong>${esc(arquivo.name)}</strong> · IA ao vivo: ao clicar, <strong>chama a API do Claude</strong> (alguns centavos) e salva no histórico.` : "O CSV tem erros.";
});

btn.addEventListener("click", async () => {
  if (!entrada || btn.disabled) return;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Roteirizando…`;
  status.textContent = entrada.cenario ? "Carregando o resultado de demonstração…" : "A IA está comparando transportadoras, veículos e modalidades… pode levar até 1 minuto.";
  alerta.innerHTML = "";
  try {
    const resp = await fetch("/api/roteirizar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entrada),
    });
    const corpo = await resp.json().catch(() => ({}));
    if (!resp.ok || !corpo.registro) {
      alerta.innerHTML = `<div class="alert alert-warning"><i class="bi bi-info-circle"></i> ${esc(corpo.erro ?? "Não foi possível roteirizar agora.")}</div>`;
      status.textContent = "";
      return;
    }
    mostrarResultado(corpo);
    status.textContent = "";
  } catch {
    alerta.innerHTML = `<div class="alert alert-danger">Falha de conexão. Tente novamente.</div>`;
  } finally {
    btn.disabled = !entrada;
    btn.innerHTML = `<i class="bi bi-cpu"></i> Roteirizar`;
  }
});

function mostrarResultado({ modo, registro: r, salvo, aviso }) {
  const selo = modo === "ao_vivo"
    ? `<span class="badge text-bg-success selo"><i class="bi bi-broadcast"></i> IA ao vivo · chamada real ao Claude</span>`
    : `<span class="badge text-bg-secondary selo"><i class="bi bi-collection-play"></i> Demonstração · resultado gerado antes pelo Claude · sem custo</span>`;
  const avisos = [
    aviso ? `<div class="alert alert-info py-2 small mb-2">${esc(aviso)}</div>` : "",
    modo === "ao_vivo" && !salvo ? `<div class="alert alert-warning py-2 small mb-2">O histórico está indisponível: esta roteirização não foi salva no dashboard.</div>` : "",
    modo === "ao_vivo" && salvo ? `<div class="alert alert-success py-2 small mb-2"><i class="bi bi-check2-circle"></i> Salva no histórico. <a href="/dashboard.html">Ver no dashboard</a></div>` : "",
  ].join("");

  resultado.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h5 mb-0">2. Resultado — ${esc(r.rotulo)}</h2>${selo}
    </div>${avisos}${painelResultado(r)}`;
  resultado.classList.remove("d-none");
  resultado.scrollIntoView({ behavior: "smooth" });
}
