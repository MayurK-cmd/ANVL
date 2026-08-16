"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TriangleAlert, Wallet } from "lucide-react";
import { useWallet } from "@/components/wallet-provider";
import { EXPLORER, FAUCET, registerIdentity, shortAddr, waitForTx } from "@/lib/wallet";

/** Registering an ERC-8004 identity is a normal write transaction — unlike
 * paying for an agent, it needs real testnet MON in the connected wallet. */
export function RegisterIdentity() {
  const wallet = useWallet();
  const router = useRouter();
  const [agentURI, setAgentURI] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!wallet.account) return;
    setBusy(true);
    setError(null);
    setTxHash(null);
    try {
      const hash = await registerIdentity(wallet.account, agentURI.trim());
      setTxHash(hash);
      await waitForTx(hash);
      setAgentURI("");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      const rejected = (err as { code?: number })?.code === 4001 || /user rejected|denied/i.test(message);
      setError(rejected ? "You declined the transaction." : message);
    } finally {
      setBusy(false);
    }
  }

  const base =
    "flex min-h-10 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass";

  return (
    <section className="rounded-sm bg-iron p-6">
      <h2 className="font-display text-xl font-bold text-bone">Register an identity</h2>
      <p className="mt-2 max-w-prose text-sm text-steel">
        Mints an ERC-8004 identity NFT to your connected wallet on{" "}
        <code className="text-ash">IdentityRegistry</code>. This is a real transaction, not a
        signature — you need testnet MON.{" "}
        <a href={FAUCET} target="_blank" rel="noreferrer noopener" className="underline hover:text-bone">
          Get some from the faucet
        </a>
        .
      </p>

      {!wallet.installed ? (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer noopener"
          className={`${base} mt-4 border border-brass/40 text-bone hover:border-brass`}
        >
          <Wallet className="size-4" aria-hidden />
          Install MetaMask
        </a>
      ) : !wallet.account ? (
        <button
          type="button"
          onClick={() => void wallet.connect()}
          disabled={wallet.busy}
          className={`${base} mt-4 bg-ember text-soot disabled:opacity-60`}
        >
          <Wallet className="size-4" aria-hidden />
          {wallet.busy ? "Connecting…" : "Connect wallet"}
        </button>
      ) : wallet.wrongChain ? (
        <button
          type="button"
          onClick={() => void wallet.switchChain()}
          disabled={wallet.busy}
          className={`${base} mt-4 bg-ember text-soot disabled:opacity-60`}
        >
          <TriangleAlert className="size-4" aria-hidden />
          Switch to Monad Testnet
        </button>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={agentURI}
            onChange={(event) => setAgentURI(event.target.value)}
            placeholder="Agent URI (optional) — e.g. your endpoint or metadata URL"
            className="min-h-10 flex-1 rounded-sm border border-brass/30 bg-transparent px-3 text-sm text-bone placeholder:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
          <button type="submit" disabled={busy} aria-busy={busy} className={`${base} bg-ember text-soot disabled:opacity-60`}>
            {busy ? "Registering…" : "Register identity"}
          </button>
        </form>
      )}

      {txHash ? (
        <p className="mt-3 text-sm text-brass">
          Registered ·{" "}
          <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer noopener" className="underline">
            {shortAddr(txHash)}
          </a>
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-400" role="alert">{error}</p> : null}
    </section>
  );
}
