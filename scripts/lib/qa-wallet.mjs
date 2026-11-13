// Playwright helper: announces an EIP-6963 "QA test wallet" in the page. The private key stays in
// Node; the page only receives the address and finished signatures. Testnet QA and film use only.
import { readFileSync } from "node:fs";
import { Wallet } from "ethers";

const ICON =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#4c4fc6"/><path d="M20 7 12 20.5 20 25l8-4.5L20 7Zm0 19.6-8-4.6L20 33l8-11-8 4.6Z" fill="#fff"/></svg>',
  ).toString("base64");

export function loadWallet({ keyFile, field = "evm", key } = {}) {
  if (key) return new Wallet(key);
  const secret = JSON.parse(readFileSync(keyFile, "utf8"))[field];
  return new Wallet(secret);
}

export async function installQaWallet(context, wallet, { name = "QA test wallet", onSign } = {}) {
  await context.exposeBinding("__tongQaSign", async (_source, payload) => {
    const data = JSON.parse(payload);
    const types = { ...data.types };
    delete types.EIP712Domain;
    if (data.domain?.name !== "Tong") throw new Error("QA wallet signs Tong requests only");
    const signature = await wallet.signTypedData(data.domain, types, data.message);
    onSign?.(data.message);
    return signature;
  });
  await context.addInitScript(
    ({ address, name, icon }) => {
      const provider = {
        isQaWallet: true,
        request: async ({ method, params }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
          if (method === "eth_chainId") return "0xaa36a7";
          if (method === "eth_signTypedData_v4") return window.__tongQaSign(params[1]);
          throw new Error(`QA wallet does not support ${method}`);
        },
      };
      const detail = Object.freeze({
        info: { uuid: "6f0c1d7e-tong-qa-wallet", name, icon, rdns: "dev.tong.qa" },
        provider,
      });
      const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { address: wallet.address, name, icon: ICON },
  );
}
