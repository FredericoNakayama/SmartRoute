// GET /api/historico — registros do MockAPI ou, se indisponível, da cópia local.
import { listarRegistros } from "../lib/mockapi.js";
import { obterHistorico } from "../lib/arquivos.js";

export async function GET() {
  return Response.json(await obterHistorico(() => listarRegistros()));
}
