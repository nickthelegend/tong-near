import React, { useEffect, useState, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Wallet,
  X,
  Code2,
  Unplug,
} from "lucide-react";
import { Wallet as EvmWallet } from "ethers";
import { useTong } from "@tong/sdk/react";
import {
  view,
  deriveSepoliaAddress,
  unsignedSepolia,
  assembleSepolia,
} from "@tong/sdk";
import deployment from "../../../deployments/testnet.json";

const contractId = deployment.contract_id;
const docsHashes = new Set([
  "#docs",
  "#quickstart",
  "#authorization",
  "#policy",
  "#agents",
  "#limits",
]);
const short = (value, n = 8) =>
  value ? `${value.slice(0, n)}…${value.slice(-6)}` : "—";
const nearLink = (id) => `https://testnet.nearblocks.io/address/${id}`;
const cx = (...parts) => parts.filter(Boolean).join(" ");
function Spinner() {
  return <LoaderCircle size={17} className="spin" aria-hidden="true" />;
}
function ChainMark({ kind }) {
  return kind === "evm" ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 2 6.5 10L12 16 5.5 12 12 2Zm0 16 6.5-4L12 22l-6.5-8 6.5 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m7 5-3 3h13l3-3H7Zm0 11-3 3h13l3-3H7Zm-3-5 3 3h13l-3-3H4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-button"
      aria-label="Copy address"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
function CodeBlock({ children }) {
  return (
    <pre>
      <code>{children}</code>
    </pre>
  );
}
function Docs() {
  return (
    <div className="docs-layout">
      <aside className="docs-nav">
        <p>Build with Tong</p>
        <a href="#quickstart">Quick start</a>
        <a href="#authorization">Authorization</a>
        <a href="#policy">Contract policy</a>
        <a href="#agents">For agents</a>
        <a href="#limits">Current limits</a>
        <a href="#playground" className="back-playground">
          Open playground <ArrowUpRight size={14} />
        </a>
      </aside>
      <article className="docs-content">
        <h1>
          One connector.
          <br />
          Their own wallet.
        </h1>
        <p className="lead">
          Bring EVM and Solana users to your NEAR dApp. Tong verifies their
          wallet signature on chain and creates a controlled account.
        </p>
        <section id="quickstart">
          <h2>Connect with Tong</h2>
          <p>
            The workspace SDK includes a vanilla connector and a React hook. Run{" "}
            <code>pnpm install</code> at the repository root; these packages are
            not published to npm yet.
          </p>
          <CodeBlock>{`import { useTong } from '@tong/sdk/react';\n\nconst tong = useTong({\n  contractId: '${contractId}',\n  relayerUrl: 'http://127.0.0.1:5371'\n});\n\nawait tong.connect('evm'); // or 'solana'\nawait tong.link();\nawait tong.setNote('Hello from my wallet');`}</CodeBlock>
          <h3>Vanilla JavaScript</h3>
          <CodeBlock>{`import { TongConnector } from '@tong/sdk';\n\nconst tong = new TongConnector({\n  contractId: '${contractId}',\n  relayerUrl: 'http://127.0.0.1:5371'\n});\nawait tong.connect('solana');\nawait tong.link();`}</CodeBlock>
          <p>
            Catch rejected signatures and relayer errors in your UI. The
            injected wallet stays responsible for signing; the SDK never
            requests a seed or private key.
          </p>
        </section>
        <section id="authorization">
          <h2>What the user signs</h2>
          <p>
            EVM wallets sign EIP-712 typed data. Solana wallets sign an exact
            UTF-8 message with the same fields. Both bind the factory domain,
            wallet, action, complete action data, nonce and deadline.
          </p>
          <CodeBlock>{`TongRequest {\n  domain: 'near:testnet:${contractId}',\n  wallet: 'evm:0x…' | 'solana:<public-key-hex>',\n  action: 'link' | 'set_note' | 'sign_sepolia',\n  data: '<JSON string>',\n  nonce: '<uint64>',\n  deadline: '<Unix seconds>'\n}`}</CodeBlock>
          <p>
            A signature expires in at most five minutes. A successful
            authorization consumes its nonce before any external call. A
            downstream failure still consumes the nonce: refresh the account
            before trying again.
          </p>
        </section>
        <section id="policy">
          <h2>A small, deliberate allowlist</h2>
          <dl className="policy-list">
            <div>
              <dt>Link account</dt>
              <dd>
                SHA-256 of the canonical wallet identity determines a
                subaccount. The child has no access keys and accepts calls only
                from Tong.
              </dd>
            </div>
            <div>
              <dt>Save a note</dt>
              <dd>
                Store up to 256 UTF-8 bytes on that child. No attached deposit.
              </dd>
            </div>
            <div>
              <dt>Sign on Sepolia</dt>
              <dd>
                Native transfers only: chain 11155111, 21,000 gas, at most 0.001
                ETH, gas price at most 100 gwei. No arbitrary calldata or
                hashes.
              </dd>
            </div>
          </dl>
          <p>
            The child constructs the EIP-155 transaction hash on chain, then
            requests an MPC signature using <code>tong:sepolia:11155111</code>.
            Different children derive different addresses.
          </p>
        </section>
        <section id="agents">
          <h2>Give agents context, keep signing with the user</h2>
          <p>
            The stdio MCP server can read identity state, prepare requests,
            verify authorizations, derive a Sepolia address and fetch a dry
            quote. It holds no signing keys and exposes no transaction
            submission tool.
          </p>
          <CodeBlock>{`{\n  "mcpServers": {\n    "tong": { "command": "node",\n      "args": ["/absolute/path/to/tong/packages/mcp/src/index.mjs"]\n    }\n  }\n}`}</CodeBlock>
        </section>
        <section id="limits">
          <h2>Know the boundaries</h2>
          <p>
            This is a testnet hackathon entry, not audited wallet
            infrastructure. The relayer sponsors at most 40 calls and reserves
            at most 4 test NEAR a day. New accounts cost 1.65 test NEAR,
            including contract storage. Chain Signature requests reserve 0.01
            test NEAR. Availability depends on relayer funds and the MPC
            network.
          </p>
          <p>
            1Click has no testnet. The funds panel requests a mainnet quote with{" "}
            <code>dry: true</code>; it creates no deposit and moves no funds.
            Sepolia broadcast requires test ETH at the derived address.
          </p>
        </section>
      </article>
    </div>
  );
}
function Playground({ evidence }) {
  const [kind, setKind] = useState("evm"),
    [provider, setProvider] = useState(undefined),
    [temp, setTemp] = useState(false);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("Hello, NEAR. From my own wallet.");
  const [receipt, setReceipt] = useState(null),
    [savedNote, setSavedNote] = useState(null),
    [derived, setDerived] = useState(null),
    [signed, setSigned] = useState(null),
    [quote, setQuote] = useState(null),
    [quoteBusy, setQuoteBusy] = useState(false);
  const tong = useTong({ contractId, evmProvider: provider });
  const pending = busy || tong.pending;
  const refreshNote = useCallback(async () => {
    if (tong.identity?.ready) {
      const state = await view(tong.identity.account_id, "get_state");
      setSavedNote(state.note);
    }
  }, [tong.identity?.account_id, tong.identity?.ready]);
  useEffect(() => {
    refreshNote().catch(() => {});
  }, [refreshNote]);
  useEffect(() => {
    let active = true;
    if (tong.identity?.ready)
      deriveSepoliaAddress(tong.identity.account_id)
        .then((x) => {
          if (active) setDerived(x);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [tong.identity?.account_id, tong.identity?.ready]);
  useEffect(() => {
    if (!provider) return;
    tong.connect("evm").catch((e) => setMessage(e.message));
  }, [provider]);
  async function act(fn) {
    setMessage("");
    setBusy(true);
    try {
      const result = await fn();
      if (result?.txHash) setReceipt(result);
      return result;
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  function temporary() {
    const wallet = EvmWallet.createRandom();
    setKind("evm");
    setTemp(true);
    setProvider({
      request: async ({ method, params }) => {
        if (method === "eth_requestAccounts") return [wallet.address];
        if (method === "eth_signTypedData_v4") {
          const data = JSON.parse(params[1]);
          const types = { ...data.types };
          delete types.EIP712Domain;
          return wallet.signTypedData(data.domain, types, data.message);
        }
        throw new Error("Unsupported test wallet method");
      },
    });
  }
  function disconnect() {
    tong.disconnect();
    setProvider(undefined);
    setTemp(false);
    setReceipt(null);
    setSavedNote(null);
    setDerived(null);
    setSigned(null);
    setMessage("");
  }
  async function signTransfer() {
    if (!derived) throw new Error("Derived address is not available yet");
    const rpc = async (method, params = []) => {
      const r = await fetch("https://ethereum-sepolia-rpc.publicnode.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const b = await r.json();
      if (b.error) throw new Error(b.error.message);
      return b.result;
    };
    if (BigInt(await rpc("eth_chainId")) !== 11155111n)
      throw new Error("Sepolia RPC returned a different network");
    const transfer = {
      to: derived,
      value_wei: "0",
      nonce: String(
        BigInt(await rpc("eth_getTransactionCount", [derived, "pending"])),
      ),
      gas_price_wei: String(BigInt(await rpc("eth_gasPrice"))),
    };
    const out = await tong.signSepolia(transfer);
    const assembled = assembleSepolia(transfer, out.result);
    if (
      assembled.from.toLowerCase() !== derived.toLowerCase() ||
      assembled.unsignedHash !== unsignedSepolia(transfer).unsignedHash
    )
      throw new Error("Returned signature did not match the derived account");
    setSigned({ ...assembled, txHash: out.txHash });
    return out;
  }
  const ready = tong.identity?.ready;
  return (
    <>
      <main className="hero" id="playground">
        <div className="hero-story">
          <h1>
            Your wallet.
            <br />A world closer<span>.</span>
          </h1>
          <p className="hero-description">
            EVM or Solana wallets, acting on NEAR.
            <br className="desktop-break" /> Chain Signatures to Sepolia. Keep
            your wallet.
          </p>
          <a className="text-link" href="#docs">
            Build with Tong <ArrowUpRight size={17} />
          </a>
          <div className="hero-object">
            <img
              src="/art/3d/plug-and-socket.webp"
              alt="A pearl plug and coral socket, about to connect"
              fetchPriority="high"
            />
            <div className="art-caption">
              <span className="fine-line" />通 <span>To connect.</span>
            </div>
          </div>
          <div className="trust-line">
            <ShieldCheck size={17} />
            <span>Verified on NEAR. Signed by you.</span>
          </div>
        </div>
        <section className="connect-workbench" aria-labelledby="connect-title">
          <div className="panel-top">
            <span className="small-logo">通</span>
            <span>Your connection starts here</span>
            <LockKeyhole size={16} />
          </div>
          <div className="panel-body">
            {!tong.wallet ? (
              <>
                <h2 id="connect-title">Come as you are.</h2>
                <p>
                  Your existing wallet is your way in.
                  <br />
                  No new seed phrase. No NEAR wallet setup.
                </p>
                <div className="wallet-options" aria-label="Wallet network">
                  <button
                    aria-pressed={kind === "evm"}
                    className={cx(
                      "wallet-option",
                      kind === "evm" && "selected",
                    )}
                    onClick={() => setKind("evm")}
                    disabled={pending}
                  >
                    <ChainMark kind="evm" />
                    <span>
                      Ethereum & EVM<small>MetaMask, Rabby & more</small>
                    </span>
                    {kind === "evm" ? (
                      <Check size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </button>
                  <button
                    aria-pressed={kind === "solana"}
                    className={cx(
                      "wallet-option",
                      kind === "solana" && "selected",
                    )}
                    onClick={() => setKind("solana")}
                    disabled={pending}
                  >
                    <ChainMark kind="solana" />
                    <span>
                      Solana<small>Phantom & compatible wallets</small>
                    </span>
                    {kind === "solana" ? (
                      <Check size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}
                  </button>
                </div>
                <button
                  className="primary"
                  disabled={pending}
                  onClick={() => act(() => tong.connect(kind))}
                >
                  {pending ? <Spinner /> : <Link2 size={18} />}{" "}
                  {pending ? "Waiting for your wallet…" : "Connect with Tong"}
                  <ArrowRight size={18} />
                </button>
                <div className="test-wallet-row">
                  <span>Just looking around?</span>
                  <button onClick={temporary} disabled={pending}>
                    Use a temporary test wallet <ArrowUpRight size={13} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="connected-heading">
                  <h2 id="connect-title">
                    {ready ? "You’re connected." : "Make it yours."}
                  </h2>
                  <button
                    className="icon-button"
                    onClick={disconnect}
                    aria-label="Disconnect wallet"
                    disabled={pending}
                  >
                    <Unplug size={18} />
                  </button>
                </div>
                <p>
                  {temp
                    ? "Temporary EVM test wallet · lost on reload."
                    : `${kind === "evm" ? "EVM" : "Solana"} wallet connected. Your keys stay with you.`}
                </p>
                <div className="identity-summary">
                  <div>
                    <Wallet size={17} />
                    <span>Your wallet</span>
                    <code title={tong.wallet}>{short(tong.wallet, 13)}</code>
                  </div>
                  <div>
                    <Link2 size={17} />
                    <span>NEAR account</span>
                    {ready ? (
                      <a
                        href={nearLink(tong.identity.account_id)}
                        target="_blank"
                        rel="noreferrer"
                        title={tong.identity.account_id}
                      >
                        {short(tong.identity.account_id, 10)}{" "}
                        <ArrowUpRight size={13} />
                      </a>
                    ) : (
                      <span className="status-label">
                        Waiting for signature
                      </span>
                    )}
                  </div>
                </div>
                {!ready ? (
                  <>
                    <p className="sign-explainer">
                      Sign a request to create your controlled NEAR account.
                      Tong sponsors the testnet gas and storage.
                    </p>
                    <button
                      className="primary"
                      disabled={pending || !!tong.identity}
                      onClick={() => act(() => tong.link())}
                    >
                      {pending ? <Spinner /> : <ShieldCheck size={17} />}{" "}
                      {pending
                        ? "Confirming on NEAR…"
                        : "Sign & create account"}
                      <ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <label className="note-label" htmlFor="note">
                      Leave your first mark on NEAR
                    </label>
                    <div className="note-input">
                      <input
                        id="note"
                        value={note}
                        maxLength={120}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={pending}
                      />
                      <button
                        aria-label="Sign and save note on NEAR"
                        disabled={pending || !note.trim()}
                        onClick={() =>
                          act(async () => {
                            const out = await tong.setNote(note);
                            await refreshNote();
                            return out;
                          })
                        }
                      >
                        {pending ? <Spinner /> : <ArrowRight size={18} />}
                      </button>
                    </div>
                    {savedNote && (
                      <div className="saved-note">
                        <Check size={14} />
                        <span>On chain: {savedNote}</span>
                      </div>
                    )}
                    <div className="derived-row">
                      <Globe2 size={16} />
                      <span>Sepolia</span>
                      {derived ? (
                        <>
                          <code title={derived}>{short(derived)}</code>
                          <CopyButton text={derived} />
                        </>
                      ) : (
                        <span>Deriving address…</span>
                      )}
                    </div>
                    <button
                      className="secondary sign-cross"
                      disabled={pending || !derived}
                      onClick={() => act(signTransfer)}
                    >
                      {pending ? <Spinner /> : <Code2 size={16} />}Sign a
                      Sepolia test transaction <ArrowUpRight size={16} />
                    </button>
                    <p className="fine-print">
                      Zero-value self transfer. Signing only; broadcasting needs
                      Sepolia test ETH.
                    </p>
                  </>
                )}
              </>
            )}
            {message && (
              <div className="error-message" role="alert">
                <span>{message}</span>
                <button
                  aria-label="Dismiss error"
                  onClick={() => setMessage("")}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {receipt && (
              <a
                className="receipt"
                href={receipt.explorer}
                target="_blank"
                rel="noreferrer"
              >
                <Check size={15} />
                <span>
                  Confirmed on NEAR <code>{short(receipt.txHash, 7)}</code>
                </span>
                <ExternalLink size={14} />
              </a>
            )}
            {signed && (
              <details className="signed-data">
                <summary>View your signed Sepolia transaction</summary>
                <p>Recovered signer: {signed.from}</p>
                <code>{signed.rawTransaction}</code>
              </details>
            )}
          </div>
          <div className="panel-footer">
            <span className="status-dot" />
            <span>NEAR testnet</span>
            <span>Real signatures. Test funds.</span>
          </div>
        </section>
      </main>
      <section className="connection-route" aria-label="Connection flow">
        <div>
          <span className="route-icon">
            <Wallet size={19} />
          </span>
          <span>
            <strong>Your existing wallet</strong>
            <small>EVM or Solana</small>
          </span>
        </div>
        <span className="route-line">
          <ArrowRight size={16} />
        </span>
        <div>
          <span className="route-icon coral">
            <ShieldCheck size={19} />
          </span>
          <span>
            <strong>One signed request</strong>
            <small>Verified on chain</small>
          </span>
        </div>
        <span className="route-line">
          <ArrowRight size={16} />
        </span>
        <div>
          <span className="route-icon">
            <Globe2 size={19} />
          </span>
          <span>
            <strong>Your NEAR account</strong>
            <small>Ready to reach further</small>
          </span>
        </div>
      </section>
      <section className="proof-section" id="proof">
        <div className="section-intro">
          <h2>
            A connection you
            <br />
            can check.
          </h2>
          <p>
            Live contracts. Inspectable receipts.
            <br />
            Follow the signature all the way through.
          </p>
          <a
            className="text-link"
            href={nearLink(contractId)}
            target="_blank"
            rel="noreferrer"
          >
            Explore the contract <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="proof-list">
          <div className="proof-row">
            <span className="proof-mark">
              <Check size={17} />
            </span>
            <div>
              <h3>Foreign wallet → NEAR</h3>
              <p>EIP-712 and ed25519 signatures verified by the contract.</p>
            </div>
            <span className="proof-tag">
              {evidence.identities ? "Recorded" : "Loading…"}
            </span>
          </div>
          <div className="proof-row">
            <span className="proof-mark">
              <ShieldCheck size={17} />
            </span>
            <div>
              <h3>Controlled, without a NEAR key</h3>
              <p>Deterministic accounts. Nonces, expiry and bounded actions.</p>
            </div>
            <span className="proof-tag">
              {deployment.locked ? "Locked" : "Deployed"}
            </span>
          </div>
          <div className="proof-row">
            <span className="proof-mark">
              <ArrowUpRight size={17} />
            </span>
            <div>
              <h3>NEAR → Sepolia</h3>
              <p>
                {evidence.signature ? (
                  <>
                    MPC signature verified.{" "}
                    {evidence.signature.broadcast_status === "BROADCAST"
                      ? "Transaction broadcast to Sepolia."
                      : "Broadcast awaits Sepolia test ETH."}
                  </>
                ) : (
                  "Loading recorded Chain Signatures evidence…"
                )}
              </p>
              {evidence.signature && (
                <a
                  href={evidence.signature.near_explorer}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Chain Signature receipt <ArrowUpRight size={13} />
                </a>
              )}
            </div>
            <span
              className={cx(
                "proof-tag",
                evidence.signature?.broadcast_status !== "BROADCAST" && "muted",
              )}
            >
              {evidence.signature ? "Signed" : "Loading…"}
            </span>
          </div>
        </div>
      </section>
      <section className="funds-section">
        <div className="funds-art">
          <img
            src="/art/3d/bridge.webp"
            alt="Pearl bridge with a warm coral rail"
            loading="lazy"
          />
        </div>
        <div className="funds-copy">
          <h2>What about the funds?</h2>
          <p>
            Preview a route with NEAR Intents’ 1Click API.
            <br />
            This is a live <strong>mainnet dry quote</strong> — no funds move.
          </p>
          <div className="quote-route">
            <span>
              10 USDC <small>Ethereum</small>
            </span>
            <ArrowRight size={19} />
            <span>
              {quote?.result?.quote?.amountOutFormatted
                ? `${Number(quote.result.quote.amountOutFormatted).toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC`
                : "USDC"}
              <small>NEAR</small>
            </span>
            <button
              className="secondary"
              disabled={quoteBusy}
              onClick={async () => {
                setQuoteBusy(true);
                try {
                  const response = await fetch("/api/quote");
                  const body = await response.json();
                  if (!response.ok) throw new Error(body.error);
                  setQuote(body);
                } catch (error) {
                  setQuote({ error: error.message });
                } finally {
                  setQuoteBusy(false);
                }
              }}
            >
              {quoteBusy ? <Spinner /> : "Get dry quote"}
              <ArrowUpRight size={15} />
            </button>
          </div>
          {quote?.error && (
            <p role="alert" className="quote-error">
              Quote unavailable: {quote.error}
            </p>
          )}
          {quote && !quote.error && (
            <p className="quote-success">
              <Check size={14} /> Live quote received. dry: true. Not a testnet
              bridge.
            </p>
          )}
        </div>
      </section>
      <section className="developer-strip">
        <div>
          <h2>
            A familiar wallet.
            <br />A few lines of code.
          </h2>
          <a className="text-link" href="#docs">
            Read the integration guide <ArrowUpRight size={16} />
          </a>
        </div>
        <CodeBlock>{`const tong = new TongConnector({ contractId });\nawait tong.connect('evm');\nawait tong.link();\n\n// The same wallet. A new connection.\nawait tong.setNote('Hello, NEAR.');`}</CodeBlock>
      </section>
    </>
  );
}
export default function App() {
  const [page, setPage] = useState(
    docsHashes.has(location.hash) ? "docs" : "playground",
  );
  const [evidence, setEvidence] = useState({}),
    [health, setHealth] = useState("checking"),
    [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    const listener = () => {
      setPage(docsHashes.has(location.hash) ? "docs" : "playground");
      setMobileMenu(false);
      requestAnimationFrame(() => {
        if (["#docs", "#playground", ""].includes(location.hash))
          window.scrollTo(0, 0);
        else document.getElementById(location.hash.slice(1))?.scrollIntoView();
      });
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(() => setHealth("online"))
      .catch(() => setHealth("offline"));
    for (const [key, file] of [
      ["identities", "demo-identities"],
      ["signature", "chain-signature"],
    ])
      fetch(`/evidence/${file}.json`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => setEvidence((e) => ({ ...e, [key]: data })))
        .catch(() => {});
  }, []);
  return (
    <div className="site-shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#playground" aria-label="Tong home">
          <span className="brand-mark">通</span>
          <span>
            tong<span className="brand-period">.</span>
          </span>
        </a>
        <nav className={mobileMenu ? "open" : ""} aria-label="Main navigation">
          <a
            href="#playground"
            className={page === "playground" ? "active" : ""}
          >
            Playground
          </a>
          <a href="#docs" className={page === "docs" ? "active" : ""}>
            Documentation
          </a>
          <a href="#proof">
            On-chain proof <ArrowUpRight size={13} />
          </a>
        </nav>
        <div
          className="network-status"
          title={
            health === "online"
              ? "Sponsorship relayer available"
              : health === "offline"
                ? "Start the local relayer to sponsor requests"
                : "Checking relayer"
          }
        >
          <span
            className={cx("status-dot", health !== "online" && "inactive")}
          />
          <span>
            {health === "online"
              ? "Testnet playground"
              : health === "checking"
                ? "Checking relayer…"
                : "Relayer offline"}
          </span>
        </div>
        <button
          className="menu-button icon-button"
          aria-label={mobileMenu ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenu}
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          {mobileMenu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      <div id="content" tabIndex={-1}>
        {page === "docs" ? <Docs /> : <Playground evidence={evidence} />}
      </div>
      <footer>
        <a className="brand footer-brand" href="#playground">
          <span className="brand-mark">通</span>
          <span>tong.</span>
        </a>
        <p>Less distance. More connection.</p>
        <div>
          <span>Built at NEAR HACKATHON · 2026</span>
          <a href="/evidence/testnet.json" target="_blank" rel="noreferrer">
            Deployment <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
    </div>
  );
}
