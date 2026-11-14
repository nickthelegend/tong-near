import React, { useEffect, useState } from "react";
import { Bot, Code2, Package, Terminal } from "lucide-react";
import { CONTRACT_ID, getConfig } from "../lib/chain.js";
import { CopyButton, Ext, cx } from "../components/ui.jsx";

const SNIPPETS = {
  React: `import { useTong } from '@tong/sdk/react'
const GUESTBOOK = 'guestbook.near-examples.testnet'

export function ConnectButton() {
  const tong = useTong({ contractId: '${CONTRACT_ID}', relayerUrl })

  const post = async () => {
    await tong.grant(GUESTBOOK, ['add_message'], '0', 7)   // once, shown in the wallet
    await tong.call(GUESTBOOK, 'add_message', { text: 'gm NEAR' })
  }
  return tong.wallet
    ? <button onClick={post}>Post to the guestbook</button>
    : <button onClick={() => tong.connect('evm')}>Continue with MetaMask</button>
}`,
  JavaScript: `import { TongConnector } from '@tong/sdk'

const tong = new TongConnector({ contractId: '${CONTRACT_ID}', relayerUrl })

await tong.connect('solana')               // or 'evm'
await tong.link('maya')                    // maya.${CONTRACT_ID}, zero keys
await tong.call('wrap.testnet', 'near_deposit', {}, '100000000000000000000000')
await tong.sendNear('bob.testnet', '50000000000000000000000')

try {
  await tong.call('wrap.testnet', 'near_deposit', {}, '500000000000000000000000')
} catch (e) {
  e.refused  // true: over the 0.2 NEAR cap, refused on chain; e.txHash is the receipt
}

const tx = await tong.signSepolia({ to, value_wei: '0', nonce, gas_price_wei })
// tx.result is the NEAR MPC signature for your derived Sepolia address`,
  "Request schema": `TongRequest {
  domain:   'near:testnet:${CONTRACT_ID}'
  wallet:   'evm:0x<40 hex>' | 'solana:<64 hex public key>'
  action:   'link' | 'call' | 'send_near' | 'grant' | 'revoke'
          | 'set_note' | 'sign_sepolia'
  data:     '<exact JSON string>'
            link  {"name":"maya"}
            call  {"contract","method","args","deposit"}
            grant {"contract","methods","max_deposit","days"}
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
            The Tong SDK asks the user's wallet to sign, sends the request to a sponsor, and your contract sees a normal named NEAR account.
            Your app asks for one grant; the contract keeps you inside it.
          </p>
          <a className="btn btn-dark btn-sm" href="#/demo" style={{ marginBottom: 14 }}>
            Open the demo dApp: NEAR Guestbook in 6 lines
          </a>
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
