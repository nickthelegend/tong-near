import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Evidence is append-only. Revalidation and fresh signatures both receive new files.
export async function newestChainSignature(directory = "deployments") {
  const candidates = [];
  for (const file of await readdir(directory)) {
    if (!/^chain-signature(?:-[a-zA-Z0-9-]+)?\.json$/.test(file)) continue;
    const evidence = JSON.parse(await readFile(join(directory, file), "utf8"));
    if (!evidence.rawTransaction || !evidence.transfer || !evidence.predecessor)
      continue;
    const at = Date.parse(evidence.at);
    if (!Number.isFinite(at))
      throw new Error(`Invalid evidence timestamp: ${file}`);
    candidates.push({ file, evidence, at });
  }
  candidates.sort((a, b) => b.at - a.at || b.file.localeCompare(a.file));
  if (!candidates.length)
    throw new Error("No signed Sepolia transaction evidence found");
  return candidates[0];
}

export async function sepoliaRpc(method, params = []) {
  const response = await fetch("https://ethereum-sepolia-rpc.publicnode.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Sepolia RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}
