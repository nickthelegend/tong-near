import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Wallet as EvmWallet } from "ethers";
import {
  TongConnector,
  deriveSepoliaAddress,
  assembleSepolia,
  unsignedSepolia,
  FEES,
} from "@tong/sdk";
import {
  CONTRACT_ID,
  getIdentity,
  deriveAccount,
  viewAccount,
  childState,
  sepoliaSnapshot,
  sepolia,
  relayerHealth,
} from "./chain.js";

const Ctx = createContext(null);
export const useTongApp = () => useContext(Ctx);

const load = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable: state stays in memory */
  }
};

/* Wallet discovery: EIP-6963 announcements, legacy window.ethereum and Solana injections. */
export function useDetectedWallets() {
  const [evm, setEvm] = useState([]);
  const [solana, setSolana] = useState([]);
  useEffect(() => {
    const seen = new Map();
    const onAnnounce = (event) => {
      const { info, provider } = event.detail ?? {};
      if (!info?.uuid || seen.has(info.rdns || info.uuid)) return;
      seen.set(info.rdns || info.uuid, true);
      setEvm((list) => [...list, { id: info.rdns || info.uuid, name: info.name, icon: info.icon, kind: "evm", provider }]);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const t = setTimeout(() => {
      if (seen.size === 0 && window.ethereum) {
        const name = window.ethereum.isRabby
          ? "Rabby"
          : window.ethereum.isCoinbaseWallet
            ? "Coinbase Wallet"
            : window.ethereum.isMetaMask
              ? "MetaMask"
              : "Browser wallet";
        setEvm([{ id: "injected", name, kind: "evm", provider: window.ethereum }]);
      }
      const sol = [];
      if (window.phantom?.solana?.signMessage) sol.push({ id: "phantom", name: "Phantom", kind: "solana", provider: window.phantom.solana });
      if (window.solflare?.signMessage) sol.push({ id: "solflare", name: "Solflare", kind: "solana", provider: window.solflare });
      if (window.backpack?.signMessage) sol.push({ id: "backpack", name: "Backpack", kind: "solana", provider: window.backpack });
      setSolana(sol);
    }, 350);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(t);
    };
  }, []);
  return { evm, solana };
}

function temporaryProvider() {
  const wallet = EvmWallet.createRandom();
  return {
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [wallet.address];
      if (method === "eth_signTypedData_v4") {
        const data = JSON.parse(params[1]);
        const types = { ...data.types };
        delete types.EIP712Domain;
        return wallet.signTypedData(data.domain, types, data.message);
      }
      throw new Error("The temporary test wallet only signs Tong requests");
    },
  };
}

const PHASES = {
  prepare: "Preparing request",
  wallet: "Waiting for your wallet",
  relay: "Executing on NEAR",
  done: "Confirmed",
};

export function TongProvider({ children }) {
  const [wallets, setWallets] = useState(() => load("tong.wallets", []));
  const [active, setActive] = useState(() => load("tong.active", null));
  const [sessionWallet, setSessionWallet] = useState(null); // wallet with a live signer in this tab
  const connectorRef = useRef(null);
  const [identity, setIdentity] = useState(undefined); // undefined = loading, null = not linked
  const [predicted, setPredicted] = useState(null);
  const [account, setAccount] = useState(null);
  const [state, setState] = useState(null);
  const [derived, setDerived] = useState(null);
  const [eth, setEth] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [readError, setReadError] = useState(null);
  const [task, setTask] = useState(null); // {action, phase, error, result}
  const [activity, setActivity] = useState(() => load("tong.activity", []));
  const [signed, setSigned] = useState(() => load("tong.signed", {}));

  useEffect(() => save("tong.wallets", wallets), [wallets]);
  useEffect(() => save("tong.active", active), [active]);
  useEffect(() => save("tong.activity", activity.slice(0, 60)), [activity]);
  useEffect(() => save("tong.signed", signed), [signed]);

  const activeEntry = wallets.find((w) => w.wallet === active) ?? null;
  const canSign = !!active && sessionWallet === active && !!connectorRef.current;

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await relayerHealth());
      setHealthError(null);
    } catch (e) {
      setHealthError(e.message);
    }
  }, []);
  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const refresh = useCallback(async () => {
    if (!active) {
      setIdentity(null);
      return;
    }
    setReadError(null);
    try {
      const id = await getIdentity(active);
      setIdentity(id);
      if (!id) {
        setPredicted(await deriveAccount(active));
        setAccount(null);
        setState(null);
        setDerived(null);
        setEth(null);
        return;
      }
      const [acct, st] = await Promise.all([viewAccount(id.account_id), id.ready ? childState(id.account_id) : null]);
      setAccount(acct);
      setState(st);
      if (id.ready) {
        const addr = await deriveSepoliaAddress(id.account_id);
        setDerived(addr);
        try {
          setEth({ ...(await sepoliaSnapshot(addr)), at: Date.now() });
        } catch (e) {
          setEth({ error: e.message });
        }
      }
    } catch (e) {
      setReadError(e.message);
    }
  }, [active]);
  useEffect(() => {
    setIdentity(undefined);
    setAccount(null);
    setState(null);
    setDerived(null);
    setEth(null);
    refresh();
  }, [refresh]);

  const remember = useCallback((entry) => {
    setWallets((list) => [{ ...entry, at: Date.now() }, ...list.filter((w) => w.wallet !== entry.wallet)]);
    setActive(entry.wallet);
  }, []);

  const connect = useCallback(
    async (option) => {
      const provider = option.id === "temporary" ? temporaryProvider() : option.provider;
      const connector = new TongConnector(
        option.kind === "evm"
          ? { contractId: CONTRACT_ID, evmProvider: provider }
          : { contractId: CONTRACT_ID, solanaProvider: provider },
      );
      const { wallet } = await connector.connect(option.kind);
      connectorRef.current = connector;
      setSessionWallet(wallet);
      remember({ wallet, kind: option.kind, name: option.name, temporary: option.id === "temporary" });
      return wallet;
    },
    [remember],
  );

  const switchTo = useCallback((wallet) => setActive(wallet), []);
  const forget = useCallback(
    (wallet) => {
      setWallets((list) => list.filter((w) => w.wallet !== wallet));
      if (sessionWallet === wallet) {
        connectorRef.current = null;
        setSessionWallet(null);
      }
      if (active === wallet) setActive(null);
    },
    [active, sessionWallet],
  );
  const disconnect = useCallback(() => {
    connectorRef.current?.disconnect();
    connectorRef.current = null;
    setSessionWallet(null);
  }, []);

  const log = useCallback((entry) => setActivity((a) => [{ ...entry, at: Date.now() }, ...a]), []);

  const run = useCallback(
    async (action, data, label) => {
      const connector = connectorRef.current;
      if (!connector || connector.wallet !== active) throw new Error("Reconnect this wallet to sign.");
      setTask({ action, phase: "prepare", label });
      try {
        const request = await connector.prepare(action, data);
        setTask({ action, phase: "wallet", label, request });
        const authorization = await connector.authorize(request);
        setTask({ action, phase: "relay", label, request, signature: authorization.signature });
        const result = await connector.submit(authorization);
        setTask({ action, phase: "done", label, request, signature: authorization.signature, result });
        log({ hash: result.txHash, label, kind: action, wallet: active, ok: true });
        refreshHealth();
        return result;
      } catch (e) {
        const message = /user rejected|denied|4001/i.test(e.message) ? "You declined the request in your wallet." : e.message;
        setTask((t) => ({ ...(t ?? { action }), error: message }));
        throw new Error(message);
      }
    },
    [active, log, refreshHealth],
  );

  const link = useCallback(async () => {
    const out = await run("link", {}, "Account created");
    await refresh();
    return out;
  }, [run, refresh]);

  const setNote = useCallback(
    async (note) => {
      const out = await run("set_note", { note }, "Note saved on NEAR");
      await refresh();
      return out;
    },
    [run, refresh],
  );

  const prepareTransfer = useCallback(
    async ({ to, valueWei = "0" }) => {
      if (!derived) throw new Error("Sepolia address is still loading");
      const snap = await sepoliaSnapshot(derived);
      return {
        to: to || derived,
        value_wei: String(valueWei),
        nonce: String(snap.nonce),
        gas_price_wei: String(snap.gasPrice * 2n > 0n ? snap.gasPrice * 2n : 1n),
        balance: snap.balance,
      };
    },
    [derived],
  );

  const signSepolia = useCallback(
    async (transfer) => {
      const { balance, ...t } = transfer;
      const out = await run("sign_sepolia", t, "Chain Signature for Sepolia");
      const assembled = assembleSepolia(t, out.result);
      if (assembled.from.toLowerCase() !== derived.toLowerCase() || assembled.unsignedHash !== unsignedSepolia(t).unsignedHash)
        throw new Error("Returned signature did not match your derived Sepolia address");
      const record = {
        ...assembled,
        transfer: t,
        nearTx: out.txHash,
        at: Date.now(),
        maxCostWei: String(21000n * BigInt(t.gas_price_wei) + BigInt(t.value_wei)),
        broadcast: null,
      };
      setSigned((s) => ({ ...s, [active]: [record, ...(s[active] ?? [])].slice(0, 10) }));
      return record;
    },
    [run, derived, active],
  );

  const broadcast = useCallback(
    async (record) => {
      const snap = await sepoliaSnapshot(record.from);
      if (snap.balance < BigInt(record.maxCostWei))
        throw new Error(`Needs ${record.maxCostWei} wei of Sepolia test ETH at ${record.from}; it holds ${snap.balance} wei.`);
      if (snap.nonce !== BigInt(record.transfer.nonce)) throw new Error("This signature's nonce is stale. Sign again.");
      const hash = await sepolia("eth_sendRawTransaction", [record.rawTransaction]);
      setSigned((s) => ({
        ...s,
        [active]: (s[active] ?? []).map((r) => (r.hash === record.hash ? { ...r, broadcast: { hash, at: Date.now() } } : r)),
      }));
      log({ hash, label: "Broadcast to Sepolia", kind: "broadcast", wallet: active, ok: true, chain: "sepolia" });
      return hash;
    },
    [active, log],
  );

  const value = useMemo(
    () => ({
      wallets,
      active,
      activeEntry,
      canSign,
      sessionWallet,
      identity,
      predicted,
      account,
      state,
      derived,
      eth,
      health,
      healthError,
      readError,
      task,
      phases: PHASES,
      clearTask: () => setTask(null),
      activity: activity.filter((a) => a.wallet === active),
      signed: signed[active] ?? [],
      fees: FEES,
      connect,
      switchTo,
      forget,
      disconnect,
      refresh,
      refreshHealth,
      link,
      setNote,
      prepareTransfer,
      signSepolia,
      broadcast,
    }),
    [wallets, active, activeEntry, canSign, sessionWallet, identity, predicted, account, state, derived, eth, health, healthError, readError, task, activity, signed, connect, switchTo, forget, disconnect, refresh, refreshHealth, link, setNote, prepareTransfer, signSepolia, broadcast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
