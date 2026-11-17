// Histórico de roteirizações no MockAPI. Só as funções do servidor chamam este módulo (a URL fica em variável de ambiente).

function urlRecurso() {
  const base = process.env.MOCKAPI_URL;
  if (!base) throw new Error("MOCKAPI_URL não configurada.");
  return `${base.replace(/\/$/, "")}/roteirizacoes`;
}

async function verificar(resposta) {
  if (!resposta.ok) throw new Error(`MockAPI respondeu ${resposta.status}.`);
  return resposta.json();
}

export async function listarRegistros(fetchFn = fetch) {
  return verificar(await fetchFn(urlRecurso()));
}

export async function salvarRegistro(registro, fetchFn = fetch) {
  return verificar(
    await fetchFn(urlRecurso(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(registro),
    }),
  );
}
