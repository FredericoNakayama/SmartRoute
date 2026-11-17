// Servidor local: serve public/ e roteia /api/<nome> para os mesmos handlers usados na Vercel.
// Uso: npm run dev  ->  http://localhost:3000
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("./public/", import.meta.url));
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const PORTA = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  try {
    const api = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (api) {
      const modulo = await import(`./api/${api[1]}.js`);
      const handler = modulo[req.method];
      if (!handler) return res.writeHead(405).end();
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const resposta = await handler(request);
      res.writeHead(resposta.status, Object.fromEntries(resposta.headers));
      return res.end(Buffer.from(await resposta.arrayBuffer()));
    }
    const caminho = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const arquivo = normalize(join(RAIZ, caminho));
    if (!arquivo.startsWith(RAIZ)) return res.writeHead(403).end();
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
    res.end(conteudo);
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "ERR_MODULE_NOT_FOUND") return res.writeHead(404).end("Não encontrado");
    console.error(e);
    res.writeHead(500).end("Erro interno");
  }
}).listen(PORTA, () => console.log(`Roteirizador em http://localhost:${PORTA}`));
