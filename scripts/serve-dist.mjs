// Minimal static server for packages/web/dist with /api proxied to the local relayer (no Vite process).
// Usage: node scripts/serve-dist.mjs [port=5310] [relayerPort=5311]
import { createServer, request } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const port = Number(process.argv[2] ?? 5310), relayer = Number(process.argv[3] ?? 5311);
const root = fileURLToPath(new URL("../packages/web/dist/", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff" };
createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const p = request({ host: "127.0.0.1", port: relayer, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${relayer}`, origin: `http://127.0.0.1:${port}` } }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    p.on("error", () => { res.writeHead(502, { "content-type": "application/json" }); res.end('{"error":"Relayer offline"}'); });
    req.pipe(p);
    return;
  }
  const path = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  try {
    const file = join(root, path === "/" ? "index.html" : path);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Tong dist on http://127.0.0.1:${port} (api -> ${relayer})`));
