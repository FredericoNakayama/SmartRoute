// GET /api/spec — a spec de regras que orienta a IA.
import { carregarDados } from "../lib/dados.js";

export function GET() {
  return Response.json({ markdown: carregarDados().spec });
}
