import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { newestChainSignature } from "../scripts/lib/sepolia-evidence.mjs";

test("broadcast selector chooses the newest evidence timestamp and preserves originals", async () => {
  const dir = await mkdtemp(`${tmpdir()}/tong-evidence-`);
  const original = {
    at: "2026-11-12T07:40:00.000Z",
    rawTransaction: "0x01",
    transfer: { nonce: "0" },
    predecessor: "child.tong.testnet",
  };
  const recent = {
    ...original,
    at: "2026-11-12T12:00:00.000Z",
    source_evidence: "chain-signature.json",
    signature_reused: true,
  };
  try {
    await writeFile(
      `${dir}/chain-signature-r3-2026-11-12.json`,
      JSON.stringify(recent),
    );
    // Write the old file last: mtime must not decide which transaction is selected.
    await writeFile(`${dir}/chain-signature.json`, JSON.stringify(original));
    await writeFile(
      `${dir}/chain-signature-incomplete.json`,
      JSON.stringify({ at: "2030-01-01" }),
    );
    const result = await newestChainSignature(dir);
    assert.equal(result.file, "chain-signature-r3-2026-11-12.json");
    assert.equal(result.evidence.source_evidence, "chain-signature.json");
    assert.deepEqual(
      JSON.parse(await readFile(`${dir}/chain-signature.json`)),
      original,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("broadcast selector refuses a malformed timestamp instead of guessing", async () => {
  const dir = await mkdtemp(`${tmpdir()}/tong-evidence-`);
  try {
    await writeFile(
      `${dir}/chain-signature.json`,
      JSON.stringify({
        at: "invalid",
        rawTransaction: "0x01",
        transfer: {},
        predecessor: "child.tong.testnet",
      }),
    );
    await assert.rejects(() => newestChainSignature(dir), /timestamp/);
  } finally {
    await rm(dir, { recursive: true });
  }
});
