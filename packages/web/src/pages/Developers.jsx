import React, { useEffect, useState } from "react";
import { Bot, Code2, Package, Terminal } from "lucide-react";
import { CONTRACT_ID, getConfig } from "../lib/chain.js";
import { CopyButton, Ext, cx } from "../components/ui.jsx";

const SNIPPETS = {
  React: `import { useTong } from '@tong/sdk/react'

export function ConnectButton() {
  const tong = useTong({ contractId: '${CONTRACT_ID}', relayerUrl })

  return tong.wallet
    ? <button onClick={() => tong.setNote('gm NEAR')}>Sign a note</button>
    : <button onClick={async () => { await tong.connect('evm'); await tong.link() }}>
        Continue with MetaMask
      </button>
}`,
  JavaScript: `import { TongConnector } from '@tong/sdk'

const tong = new TongConnector({ contractId: '${CONTRACT_ID}', relayerUrl })

await tong.connect('solana')        // or 'evm'
await tong.link()                   // one signature creates the NEAR account
await tong.setNote('Hello, NEAR.')  // acts on NEAR, verified on chain

const tx = await tong.signSepolia({ to, value_wei: '0', nonce, gas_price_wei })
// tx.result is the NEAR MPC signature for your derived Sepolia address`,
  "Request schema": `TongRequest {
  domain:   'near:testnet:${CONTRACT_ID}'
  wallet:   'evm:0x<40 hex>' | 'solana:<64 hex public key>'
  action:   'link' | 'set_note' | 'sign_sepolia'
  data:     '<exact JSON string>'
  nonce:    '<uint64, from get_identity>'
  deadline: '<unix seconds, ≤ now + 300>'
}`,
  "MCP (agents)": `{
  "mcpServers": {
    "tong": {
      "command": "node",
      "args": ["/path/to/tong/packages/mcp/src/index.mjs"]
    }
  }
}
// tools: tong_identity, tong_prepare, tong_verify,
//        tong_derived_address, tong_dry_quote  (no signing, no submit)`,
};

export default function Developers() {
  const [tab, setTab] = useState("React");
  const [config, setConfig] = useState(null);
  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((e) => setConfig({ error: e.message }));
  }, []);
  return (
    <div className="dev-grid">
      <section className="card dev-main">
        <div className="dev-intro">
          <h2>Let MetaMask and Phantom users into your NEAR app.</h2>
          <p>
            The Tong SDK asks the user's wallet to sign, sends the request to a sponsor, and your contract sees a normal NEAR account.
          </p>
          <div className="install">
            <Terminal size={15} />
            <code>pnpm add @tong/sdk</code>
            <span className="muted small">workspace package · not on npm yet</span>
          </div>
        </div>
        <div className="code-tabs" role="tablist">
          {Object.keys(SNIPPETS).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx(tab === k && "on")} onClick={() => setTab(k)}>
              {k}
            </button>
          ))}
        </div>
        <div className="code-wrap">
          <CopyButton text={SNIPPETS[tab]} label="Copy code" />
          <pre className="code">
            <code>{SNIPPETS[tab]}</code>
          </pre>
        </div>
      </section>
      <aside className="dev-side">
        <section className="card">
          <div className="card-head">
            <h3>Live contract config</h3>
            <span className="chip">view call</span>
          </div>
          <pre className="code code-light">
            <code>{config ? JSON.stringify(config, null, 2) : "Loading from NEAR testnet…"}</code>
          </pre>
        </section>
        <section className="card">
          <div className="card-head">
            <h3>Packages</h3>
          </div>
          <ul className="list">
            {[
              [Package, "@tong/sdk", "Connector, request signing, Sepolia helpers"],
              [Code2, "@tong/sdk/react", "useTong hook with pending and error state"],
              [Bot, "@tong/mcp", "Read and prepare tools for agents"],
              [Terminal, "@tong/relayer", "Budgeted sponsor with a spend ledger"],
            ].map(([Icon, n, d]) => (
              <li key={n} className="list-row">
                <span className="w-ico">
                  <Icon size={16} />
                </span>
                <span className="grow">
                  <b className="mono">{n}</b>
                  <small>{d}</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="card-foot">
            Contract source and tests: <Ext href={`https://testnet.nearblocks.io/address/${CONTRACT_ID}`}>{CONTRACT_ID}</Ext>
          </p>
        </section>
      </aside>
    </div>
  );
}
