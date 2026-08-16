"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { Address } from "viem";
import {
  CHAIN,
  connect as connectWallet,
  currentAccounts,
  currentChainId,
  hasWallet,
  readBalances,
  signerFor,
  switchToMonad,
  type Balances,
} from "@/lib/wallet";

type WalletState = {
  installed: boolean;
  account: Address | null;
  chainId: number | null;
  wrongChain: boolean;
  balances: Balances | null;
  busy: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  refresh: () => Promise<void>;
  signer: () => ReturnType<typeof signerFor>;
};

const WalletContext = createContext<WalletState | null>(null);

/**
 * Whether an injected wallet exists. `window` is an external system, so this is
 * a store subscription rather than state — it is false during SSR and correct
 * from first paint on the client, with no hydration flash.
 */
const noopSubscribe = () => () => {};
function useWalletInstalled(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => hasWallet(),
    () => false,
  );
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const installed = useWalletInstalled();
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reconnect silently on load: eth_accounts never prompts, so a wallet the
  // user already approved comes back without a popup.
  useEffect(() => {
    if (!hasWallet()) return;

    let live = true;
    void (async () => {
      const [accounts, id] = await Promise.all([
        currentAccounts(),
        currentChainId(),
      ]);
      if (!live) return;
      setAccount(accounts[0] ?? null);
      setChainId(id);
    })();

    const provider = window.ethereum;
    const onAccounts = (next: unknown) => {
      const list = next as Address[];
      setAccount(list?.[0] ?? null);
      setBalances(null);
    };
    const onChain = (next: unknown) =>
      setChainId(Number.parseInt(next as string, 16));

    provider?.on?.("accountsChanged", onAccounts);
    provider?.on?.("chainChanged", onChain);
    return () => {
      live = false;
      provider?.removeListener?.("accountsChanged", onAccounts);
      provider?.removeListener?.("chainChanged", onChain);
    };
  }, []);

  // readBalances() never throws — a null field means "couldn't read this
  // round", so merge against whatever's already displayed instead of
  // replacing it. A stale-but-correct number beats a blank one.
  const mergeBalances = useCallback((next: Balances) => {
    setBalances((prev) => ({
      mon: next.mon ?? prev?.mon ?? null,
      anvl: next.anvl ?? prev?.anvl ?? null,
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (!account) return;
    mergeBalances(await readBalances(account));
  }, [account, mergeBalances]);

  useEffect(() => {
    if (!account) return;
    let live = true;
    void (async () => {
      const next = await readBalances(account);
      if (live) mergeBalances(next);
    })();
    return () => {
      live = false;
    };
  }, [account, mergeBalances]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await connectWallet();
      await switchToMonad();
      setAccount(next);
      setChainId(await currentChainId());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }, []);

  const switchChain = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await switchToMonad();
      setChainId(await currentChainId());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch network");
    } finally {
      setBusy(false);
    }
  }, []);

  // MetaMask has no "disconnect" — this forgets the account locally, which is
  // what the button means to a user. Reconnecting will not re-prompt.
  const disconnect = useCallback(() => {
    setAccount(null);
    setBalances(null);
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      installed,
      account,
      chainId,
      wrongChain: account !== null && chainId !== null && chainId !== CHAIN.id,
      // Derived, not stored: a stale balance must never outlive its account.
      balances: account ? balances : null,
      busy,
      error,
      connect,
      disconnect,
      switchChain,
      refresh,
      signer: () => {
        if (!account) throw new Error("Connect a wallet first");
        return signerFor(account);
      },
    }),
    [
      installed,
      account,
      chainId,
      balances,
      busy,
      error,
      connect,
      disconnect,
      switchChain,
      refresh,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
