// Limite simples por IP, em memória: protege os créditos de API da demo pública.
const LIMITE = 5;
const JANELA_MS = 10 * 60 * 1000;
const chamadas = new Map(); // ip -> timestamps

export function permitir(ip, agoraMs = Date.now()) {
  const recentes = (chamadas.get(ip) ?? []).filter((t) => agoraMs - t < JANELA_MS);
  if (recentes.length >= LIMITE) {
    chamadas.set(ip, recentes);
    return false;
  }
  recentes.push(agoraMs);
  chamadas.set(ip, recentes);
  return true;
}

export function _resetar() {
  chamadas.clear();
}
