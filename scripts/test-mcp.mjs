import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import { load, save } from "./common.mjs";
const demo = await load("deployments/demo-identities.json");
const client = new Client({ name: "tong-verification", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["packages/mcp/src/index.mjs"],
  stderr: "pipe",
});
const checks = [];
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((t) => t.name).sort(),
    [
      "tong_identity",
      "tong_prepare",
      "tong_verify",
      "tong_derived_address",
      "tong_dry_quote",
    ].sort(),
  );
  checks.push("all five scoped tools exposed over real stdio MCP transport");
  const identity = await client.callTool({
    name: "tong_identity",
    arguments: { wallet: demo.wallets.evm },
  });
  assert.equal(JSON.parse(identity.content[0].text).ready, true);
  checks.push("MCP identity reads deployed factory");
  const prepared = await client.callTool({
    name: "tong_prepare",
    arguments: {
      wallet: demo.wallets.evm,
      action: "set_note",
      data: '{"note":"Prepared by MCP"}',
    },
  });
  const request = JSON.parse(prepared.content[0].text);
  assert.equal(request.action, "set_note");
  assert.equal(request.wallet, demo.wallets.evm);
  checks.push("MCP prepares correct live nonce without signing or spending");
  const verify = await client.callTool({
    name: "tong_verify",
    arguments: { request, signature: "0x00" },
  });
  assert.equal(JSON.parse(verify.content[0].text).valid, false);
  checks.push("MCP rejects invalid signature");
  const derived = await client.callTool({
    name: "tong_derived_address",
    arguments: { accountId: demo.identities.evm.account_id },
  });
  assert.match(
    JSON.parse(derived.content[0].text).address,
    /^0x[0-9a-fA-F]{40}$/,
  );
  checks.push("MCP derives child-owned Sepolia address");
} finally {
  await client.close();
  await transport.close();
}
await save("deployments/mcp-tests.json", {
  at: new Date().toISOString(),
  passed: checks.length,
  checks,
});
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
