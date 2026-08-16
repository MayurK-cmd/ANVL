"use client";

import { useCallback, useEffect, useState } from "react";
import { TriangleAlert, Wallet } from "lucide-react";
import { parseUnits } from "viem";
import type { Agent } from "@/data/agents";
import { useWallet } from "@/components/wallet-provider";
import {
  claimReward,
  EXPLORER,
  FAUCET,
  formatToken,
  readStakeInfo,
  shortAddr,
  stakeAnvl,
  type StakeInfo,
  unstakeAnvl,
  waitForTx,
} from "@/lib/wallet";

type RowStatus = { hash?: string; error?: string };

function AgentRow({ agent, info, onChanged }: { agent: Agent; info: StakeInfo | undefined; onChanged: () => Promise<void> }) {
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"stake" | "unstake" | "claim" | null>(null);
  const [status, setStatus] = useState<RowStatus>({});

  async function run(action: "stake" | "unstake" | "claim", fn: () => Promise<`0x${string}`>) {
    setBusy(action);
    setStatus({});
    try {
      const hash = await fn();
      await waitForTx(hash);
      setStatus({ hash });
      setAmount("");
      await onChanged();
      void wallet.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : `${action} failed`;
      const rejected = (err as { code?: number })?.code === 4001 || /user rejected|denied/i.test(message);
      setStatus({ error: rejected ? "You declined the transaction." : message });
    } finally {
      setBusy(null);
    }
  }

  const account = wallet.account;
  const yourStake = info?.yourStake ?? 0n;
  const pendingReward = info?.pendingReward ?? 0n;
  const totalStaked = info?.totalStaked ?? 0n;

  return (
    <div className="border-t border-brass/10 py-4 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-bold text-bone">{agent.name}</p>
        <p className="text-sm text-ash">{formatToken(totalStaked)} ANVL staked total</p>
      </div>

      {account ? (
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-steel">
          <span>Your stake: <span className="text-bone">{formatToken(yourStake)} ANVL</span></span>
          <span>Pending reward: <span className="text-bone">{formatToken(pendingReward)} ANVL</span></span>
        </div>
      ) : null}

      {account ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount in ANVL"
            inputMode="decimal"
            className="min-h-10 flex-1 rounded-sm border border-brass/30 bg-transparent px-3 text-sm text-bone placeholder:text-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          />
          <button
            type="button"
            disabled={busy !== null || !amount.trim()}
            onClick={() => {
              const value = parseUnits(amount.trim() || "0", 18);
              void run("stake", () => stakeAnvl(account, agent.id, value));
            }}
            className="min-h-10 rounded-sm bg-ember px-4 text-sm font-semibold text-soot disabled:opacity-60"
          >
            {busy === "stake" ? "Staking…" : "Stake"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !amount.trim() || yourStake === 0n}
            onClick={() => {
              const value = parseUnits(amount.trim() || "0", 18);
              void run("unstake", () => unstakeAnvl(account, agent.id, value));
            }}
            className="min-h-10 rounded-sm border border-brass/40 px-4 text-sm font-semibold text-bone hover:border-brass disabled:opacity-40"
          >
            {busy === "unstake" ? "Unstaking…" : "Unstake"}
          </button>
          <button
            type="button"
            disabled={busy !== null || pendingReward === 0n}
            onClick={() => void run("claim", () => claimReward(account, agent.id))}
            className="min-h-10 rounded-sm border border-brass/40 px-4 text-sm font-semibold text-bone hover:border-brass disabled:opacity-40"
          >
            {busy === "claim" ? "Claiming…" : "Claim"}
          </button>
        </div>
      ) : null}

      {status.hash ? (
        <p className="mt-2 text-sm text-brass">
          Confirmed ·{" "}
          <a href={`${EXPLORER}/tx/${status.hash}`} target="_blank" rel="noreferrer noopener" className="underline">
            {shortAddr(status.hash)}
          </a>
        </p>
      ) : null}
      {status.error ? <p className="mt-2 text-sm text-red-400" role="alert">{status.error}</p> : null}
    </div>
  );
}

/** Staking is a real write transaction (needs gas), not a gasless M402 signature. */
export function StakePanel({ agents }: { agents: Agent[] }) {
  const wallet = useWallet();
  const [info, setInfo] = useState<Record<string, StakeInfo>>({});

  const refreshAll = useCallback(async () => {
    if (!wallet.account) return;
    const account = wallet.account;
    const entries = await Promise.all(
      agents.map(async (agent) => [agent.id, await readStakeInfo(agent.id, account)] as const),
    );
    setInfo(Object.fromEntries(entries));
  }, [agents, wallet.account]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  return (
    <div className="rounded-sm bg-iron p-6">
      <p className="max-w-prose text-sm text-steel">
        Stake <code className="text-ash">$ANVL</code> on an agent to earn 30% of its future call
        revenue. This is a real transaction (one signature + one gas-paying transaction via{" "}
        <code className="text-ash">stakeWithPermit</code>), not a gasless payment.{" "}
        <a href={FAUCET} target="_blank" rel="noreferrer noopener" className="underline hover:text-bone">
          Get testnet MON
        </a>
        .
      </p>

      {!wallet.installed ? (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer noopener"
          className="mt-4 flex min-h-10 w-fit items-center justify-center gap-2 rounded-sm border border-brass/40 px-4 text-sm font-semibold text-bone hover:border-brass"
        >
          <Wallet className="size-4" aria-hidden />
          Install MetaMask
        </a>
      ) : !wallet.account ? (
        <button
          type="button"
          onClick={() => void wallet.connect()}
          disabled={wallet.busy}
          className="mt-4 flex min-h-10 w-fit items-center justify-center gap-2 rounded-sm bg-ember px-4 text-sm font-semibold text-soot disabled:opacity-60"
        >
          <Wallet className="size-4" aria-hidden />
          {wallet.busy ? "Connecting…" : "Connect wallet"}
        </button>
      ) : wallet.wrongChain ? (
        <button
          type="button"
          onClick={() => void wallet.switchChain()}
          disabled={wallet.busy}
          className="mt-4 flex min-h-10 w-fit items-center justify-center gap-2 rounded-sm bg-ember px-4 text-sm font-semibold text-soot disabled:opacity-60"
        >
          <TriangleAlert className="size-4" aria-hidden />
          Switch to Monad Testnet
        </button>
      ) : null}

      <div className="mt-4">
        {agents.map((agent) => (
          <AgentRow key={agent.id} agent={agent} info={info[agent.id]} onChanged={refreshAll} />
        ))}
      </div>
    </div>
  );
}
