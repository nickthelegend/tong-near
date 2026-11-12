import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { rpc } from "../packages/sdk/src/index.mjs";

async function withEndpoint(handler, run) {
  const server = createServer(handler);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}
test("read RPC recovers from rate limiting with the original request intact", async () => {
  const requests = [];
  await withEndpoint(
    async (req, res) => {
      let text = "";
      for await (const chunk of req) text += chunk;
      requests.push(JSON.parse(text));
      if (requests.length < 3) {
        res.writeHead(requests.length === 1 ? 429 : 503, {
          "Retry-After": "0",
        });
        res.end();
      } else {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ result: { transport_test: true } }));
      }
    },
    async (url) => {
      assert.deepEqual(
        await rpc(
          "query",
          { request_type: "view_account", account_id: "transport.testnet" },
          url,
        ),
        { transport_test: true },
      );
    },
  );
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[1], requests[2]);
});
test("rate limited transaction broadcasts are never automatically replayed", async () => {
  let calls = 0;
  await withEndpoint(
    (req, res) => {
      calls++;
      req.resume();
      res.writeHead(429, { "Retry-After": "0" });
      res.end();
    },
    async (url) => {
      await assert.rejects(
        () => rpc("send_tx", { transport_test: true }, url),
        /HTTP 429/,
      );
    },
  );
  assert.equal(calls, 1);
});
test("read retries are bounded and longer provider backoffs fail closed", async () => {
  let calls = 0;
  await withEndpoint(
    (req, res) => {
      calls++;
      req.resume();
      res.writeHead(429, { "Retry-After": "0" });
      res.end();
    },
    async (url) => {
      await assert.rejects(() => rpc("query", {}, url), /HTTP 429/);
    },
  );
  assert.equal(calls, 4);
  calls = 0;
  await withEndpoint(
    (req, res) => {
      calls++;
      req.resume();
      res.writeHead(429, { "Retry-After": "30" });
      res.end();
    },
    async (url) => {
      await assert.rejects(() => rpc("query", {}, url), /HTTP 429/);
    },
  );
  assert.equal(calls, 1);
});
