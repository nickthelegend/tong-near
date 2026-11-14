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

export async function installQaWallet(context, wallet, { name = "QA test wallet", onSign, approvalSheet = false } = {}) {
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
    ({ address, name, icon, approvalSheet }) => {
      // Optional wallet-style "Sign message" sheet (QA/film signer only; never part of the production bundle).
      // It shows the exact typed message and waits for Approve or Reject before the key signs.
      const WORDS = {
        link: "Create my NEAR account (no access keys)",
        set_note: "Save a note on my NEAR account",
        sign_sepolia: "Ask NEAR to sign a Sepolia transfer with Chain Signatures",
      };
      const sheet = (data) =>
        new Promise((resolve, reject) => {
          const m = data.message;
          const el = (tag, css, text) => {
            const e = document.createElement(tag);
            e.style.cssText = css;
            if (text != null) e.textContent = text;
            return e;
          };
          const ff = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
          const back = el("div", `position:fixed;inset:0;z-index:2147483000;background:rgba(20,16,14,.46);display:flex;align-items:center;justify-content:center;font-family:${ff}`);
          back.id = "__qa_sheet";
          const card = el("div", "width:460px;max-height:86vh;background:#fff;color:#1c1917;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.42);overflow:hidden;display:flex;flex-direction:column");
          const head = el("div", "display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #ece7e2;background:#faf8f6");
          const logo = el("img", "width:26px;height:26px;border-radius:7px");
          logo.src = icon_;
          head.append(logo, el("div", "font-weight:650;font-size:15px", name));
          head.append(el("div", "margin-left:auto;font-size:11px;font-weight:600;color:#6b5f57;background:#efe9e4;border-radius:99px;padding:3px 9px", "Test wallet"));
          const body = el("div", "padding:18px 20px;overflow:auto");
          body.append(el("div", "font-size:22px;font-weight:700;letter-spacing:-.01em", "Sign message"));
          body.append(el("div", "font-size:13.5px;color:#57504a;margin:4px 0 14px", `${location.host} wants you to sign this message. NEAR will verify the signature on-chain.`));
          const chip = (k, v) => {
            const r = el("div", "display:flex;justify-content:space-between;gap:14px;font-size:13px;padding:7px 0;border-bottom:1px solid #f1ece8");
            r.append(el("span", "color:#7a6f67", k), el("span", "font-weight:600;text-align:right;word-break:break-all", v));
            return r;
          };
          body.append(chip("Signer", address.slice(0, 8) + "…" + address.slice(-6)), chip("Wallet network", "Sepolia (signs off-chain, no gas)"), chip("Verified by", "NEAR testnet"));
          const plain = el("div", "margin:14px 0 8px;padding:11px 13px;border-radius:12px;background:#fff4ec;color:#7a3410;font-size:14px;font-weight:600", WORDS[m.action] ?? m.action);
          body.append(plain);
          const box = el("div", "border:1px solid #e7e0da;border-radius:12px;padding:10px 12px;background:#fcfbfa;font:12px/1.5 ui-monospace,Menlo,monospace;color:#2b2622;max-height:250px;overflow:auto;word-break:break-all");
          const fields = [["domain", m.domain], ["wallet", m.wallet], ["action", m.action], ["data", m.data], ["nonce", m.nonce], ["deadline", m.deadline]];
          for (const [k, v] of fields) {
            const line = el("div", "margin-bottom:3px");
            line.append(el("span", "color:#9b8f86", k + ": "), el("span", "", String(v)));
            box.append(line);
          }
          body.append(box);
          const foot = el("div", "display:flex;gap:10px;padding:14px 20px 18px;border-top:1px solid #ece7e2");
          const rej = el("button", "flex:1;padding:12px;border-radius:99px;border:1px solid #d9d0c9;background:#fff;font:600 15px " + ff + ";cursor:pointer", "Reject");
          const app = el("button", "flex:1;padding:12px;border-radius:99px;border:0;background:#4c4fc6;color:#fff;font:600 15px " + ff + ";cursor:pointer", "Approve");
          app.id = "__qa_approve"; rej.id = "__qa_reject";
          rej.onclick = () => { back.remove(); reject(Object.assign(new Error("User rejected the request"), { code: 4001 })); };
          app.onclick = () => { back.remove(); resolve(); };
          foot.append(rej, app);
          card.append(head, body, foot);
          back.append(card);
          document.body.append(back);
        });
      const icon_ = icon;
      const provider = {
        isQaWallet: true,
        request: async ({ method, params }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
          if (method === "eth_chainId") return "0xaa36a7";
          if (method === "eth_signTypedData_v4") {
            if (approvalSheet) await sheet(JSON.parse(params[1]));
            return window.__tongQaSign(params[1]);
          }
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
    { address: wallet.address, name, icon: ICON, approvalSheet },
  );
}
