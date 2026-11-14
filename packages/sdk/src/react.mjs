import { useState, useCallback, useMemo } from "react";
import { TongConnector } from "./index.mjs";
export function useTong(options) {
  const connector = useMemo(
    () => new TongConnector(options),
    [
      options.contractId,
      options.rpcUrl,
      options.relayerUrl,
      options.evmProvider,
      options.solanaProvider,
    ],
  );
  const [state, setState] = useState({
    wallet: null,
    identity: null,
    pending: false,
    error: null,
  });
  const run = useCallback(
    async (fn) => {
      setState((s) => ({ ...s, pending: true, error: null }));
      try {
        const result = await fn();
        setState({
          wallet: connector.wallet,
          identity: connector.identity,
          pending: false,
          error: null,
        });
        return result;
      } catch (error) {
        setState((s) => ({ ...s, pending: false, error: error.message }));
        throw error;
      }
    },
    [connector],
  );
  return {
    ...state,
    connector,
    connect: (kind) => run(() => connector.connect(kind)),
    link: (name) => run(() => connector.link(name)),
    call: (contract, method, args, deposit) => run(() => connector.call(contract, method, args, deposit)),
    sendNear: (to, amount) => run(() => connector.sendNear(to, amount)),
    grant: (contract, methods, maxDeposit, days) => run(() => connector.grant(contract, methods, maxDeposit, days)),
    revoke: (contract) => run(() => connector.revoke(contract)),
    setNote: (note) => run(() => connector.setNote(note)),
    signSepolia: (t) => run(() => connector.signSepolia(t)),
    disconnect: () => {
      connector.disconnect();
      setState({ wallet: null, identity: null, pending: false, error: null });
    },
  };
}
