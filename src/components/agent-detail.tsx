"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Globe, Terminal, TriangleAlert, Wallet } from "lucide-react";
import type { Agent } from "@/data/agents";
import { callPaidAPI } from "@/lib/m402";
import { useWallet } from "@/components/wallet-provider";
import { EXPLORER, shortAddr } from "@/lib/wallet";

type Tab = "readme" | "playground";

type Settlement = {
  settled: boolean;
  txHash: string;
  explorerUrl?: string;
  note?: string;
};

type RunResponse = {
  result: unknown;
  logs?: string[];
  settlement?: Settlement;
};

export function AgentDetail({
  agent,
  initialTab,
}: {
  agent: Agent;
  initialTab: Tab;
}) {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(agent.params.map((param) => [param.name, ""])),
  );
  const [output, setOutput] = useState<unknown>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const missing = useMemo(
    () =>
      agent.params
        .filter((param) => param.required && !values[param.name]?.trim())
        .map((param) => param.name),
    [agent.params, values],
  );

  async function onRun(event: React.FormEvent) {
    event.preventDefault();
    if (missing.length) {
      setError(`Fill required fields: ${missing.join(", ")}`);
      return;
    }
    setBusy(true);
    setError(null);
    setOutput(null);
    setSettlement(null);

    const signer = wallet.signer();
    setLogs([
      `Paying as ${shortAddr(signer.payer)}`,
      "Requesting agent…",
      "Waiting for signature in your wallet…",
    ]);

    try {
      // Uploaded agents run on the developer's own machine, so the browser
      // calls them directly — the marketplace is discovery, not a proxy.
      const paid = await callPaidAPI<Record<string, string>, RunResponse>(
        agent.endpoint ?? `/api/agents/${agent.id}/send`,
        values,
        signer,
      );
      const result = paid.settlement ?? null;
      setSettlement(result);
      setLogs([
        `Paying as ${shortAddr(signer.payer)}`,
        "402 Payment Required",
        `Permit signed for ${agent.price} ANVL (no gas, no transaction)`,
        paid.paid ? "Signature verified" : "No payment required",
        result?.settled
          ? `Settled on Monad Testnet · ${shortAddr(result.txHash)}`
          : (result?.note ?? "Settlement skipped"),
        ...(paid.data.logs ?? []),
      ]);
      setOutput(paid.data.result);
      void wallet.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run failed";
      // MetaMask's user-rejection code, surfaced as plain language.
      const rejected =
        (err as { code?: number })?.code === 4001 ||
        /user rejected|denied/i.test(message);
      setError(rejected ? "You declined the signature — nothing was paid." : message);
      setLogs((prev) => [...prev, rejected ? "Signature declined" : "Failed"]);
    } finally {
      setBusy(false);
    }
  }

  const TypeIcon = agent.type === "browser" ? Globe : Terminal;

  return (
    <div className="mx-auto max-w-7xl">
      <nav className="text-sm text-ash">
        <Link
          href="/"
          className="hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          Store
        </Link>
        <span aria-hidden> / </span>
        <span className="text-steel">{agent.name}</span>
      </nav>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold text-bone">
              {agent.name}
            </h1>
            <span className="rounded-full border border-brass/40 px-2 py-0.5 text-xs text-brass">
              Public
            </span>
          </div>
          <a
            href={`${EXPLORER}/address/${agent.owner}`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1 font-mono text-sm text-ash hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            {shortAddr(agent.owner)}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          {agent.identityTokenId != null ? (
            <Link
              href={`/identity#token-${agent.identityTokenId}`}
              className="text-sm text-brass hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              ✅ ERC-8004 #{agent.identityTokenId}
            </Link>
          ) : (
            <p className="text-sm text-ash">Unverified identity</p>
          )}
          <p className="mt-3 max-w-prose text-steel">{agent.description}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-ember">
            <TypeIcon className="size-4" aria-hidden />
            {agent.webcmd
              ? "Browser Agent · Powered by Webcmd"
              : "API Agent"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTab("playground")}
          className="min-h-10 shrink-0 rounded-sm bg-ember px-4 text-sm font-semibold text-soot focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-soot"
        >
          Run as API →
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Agent views"
        className="mt-8 flex gap-6 border-b border-brass/20"
      >
        {(["readme", "playground"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-10 border-b-2 px-1 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
              tab === id
                ? "border-ember text-bone"
                : "border-transparent text-ash hover:text-steel"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === "readme" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article className="rounded-sm bg-iron p-6">
            <ul className="mb-6 flex flex-wrap gap-2">
              {agent.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-brass/25 px-2 py-0.5 text-xs text-ash"
                >
                  {tag}
                </li>
              ))}
            </ul>
            <h2 className="font-display text-xl font-bold text-bone">Purpose</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-steel">
              {agent.purpose.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h2 className="mt-8 font-display text-xl font-bold text-bone">
              Framework
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-steel">
              {agent.framework.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {agent.webcmd ? (
              <>
                <h2 className="mt-8 font-display text-xl font-bold text-bone">
                  Webcmd details
                </h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ash">Command</dt>
                    <dd className="font-mono text-bone">{agent.webcmd.command}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ash">Sites</dt>
                    <dd className="text-bone">{agent.webcmd.sites.join(", ")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ash">Avg execution</dt>
                    <dd className="text-bone">
                      {(agent.webcmd.avgExecutionMs / 1000).toFixed(1)}s
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ash">Auth required</dt>
                    <dd className="text-bone">
                      {agent.webcmd.requiresAuth ? "Yes" : "No"}
                    </dd>
                  </div>
                </dl>
              </>
            ) : null}
          </article>

          <aside className="space-y-4">
            <section className="rounded-sm bg-iron p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ash">
                Releases
              </h2>
              <p className="mt-2 text-sm text-steel">Coming very soon.</p>
            </section>
            <section className="rounded-sm bg-iron p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ash">
                Staking
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ash">Staked</dt>
                  <dd className="text-bone">
                    {agent.staked} ANVL
                  </dd>
                </div>
              </dl>
              <Link
                href="/stake"
                className="mt-4 flex min-h-10 w-full items-center justify-center rounded-sm border border-brass/40 text-sm font-semibold text-bone hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                Stake ANVL
              </Link>
              <p className="mt-2 text-xs text-ash">Live from StakingRevShare on Monad Testnet.</p>
            </section>
            <section className="rounded-sm bg-iron p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ash">
                Agent info
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ash">Type</dt>
                  <dd className="text-bone">
                    {agent.type === "browser" ? "Browser Agent" : "API Agent"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">Price</dt>
                  <dd className="text-bone">{agent.price} ANVL</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">Avg response</dt>
                  <dd className="text-bone">{agent.avgResponse}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ash">Owner</dt>
                  <dd className="text-bone">{shortAddr(agent.owner)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      ) : (
        <form
          onSubmit={onRun}
          className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <fieldset className="rounded-sm bg-iron p-6">
            <legend className="font-display text-lg font-bold text-bone">
              Agent configuration
            </legend>
            <div className="mt-4 space-y-4">
              {agent.params.map((param) => (
                <div key={param.name}>
                  <label
                    htmlFor={param.name}
                    className="block text-sm font-semibold text-bone"
                  >
                    {param.name}
                    {param.required ? (
                      <span className="ml-1 font-normal text-ash">(required)</span>
                    ) : null}
                  </label>
                  <p className="mt-1 text-xs text-ash">{param.description}</p>
                  <input
                    id={param.name}
                    name={param.name}
                    type="text"
                    inputMode={param.type === "number" ? "decimal" : "text"}
                    autoComplete="off"
                    placeholder={param.example}
                    value={values[param.name] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [param.name]: event.target.value,
                      }))
                    }
                    className="mt-2 min-h-10 w-full rounded-sm border border-brass/30 bg-slag px-3 text-sm text-bone placeholder:text-ash/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                  />
                </div>
              ))}
            </div>

            <RunButton agent={agent} busy={busy} />

            <p className="mt-3 text-center text-xs text-ash">
              You sign a message, not a transaction. No MON needed to run an agent.
            </p>
            {agent.endpoint ? (
              <p className="mt-2 text-center font-mono text-[11px] text-ash">
                Calls {agent.endpoint} directly
              </p>
            ) : null}
          </fieldset>

          <div className="space-y-4">
            <section className="min-h-56 rounded-sm bg-iron p-6">
              <h2 className="text-sm font-semibold text-bone">Execution output</h2>
              {error ? (
                <p className="mt-4 text-sm text-red-400" role="alert">
                  {error}
                </p>
              ) : output ? (
                <>
                  <pre className="mt-4 overflow-x-auto font-mono text-xs leading-5 text-steel">
                    {JSON.stringify(output, null, 2)}
                  </pre>
                  {settlement?.settled && settlement.explorerUrl ? (
                    <a
                      href={settlement.explorerUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-4 inline-flex items-center gap-1 text-xs text-brass hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                    >
                      View settlement on Monadscan
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : settlement && !settlement.settled ? (
                    <p className="mt-4 text-xs text-ash">
                      Signature verified. On-chain settlement is off — see
                      <code className="mx-1 text-brass">.env.example</code>.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-8 text-center text-sm text-ash">
                  Waiting for a run.
                </p>
              )}
            </section>
            <section className="min-h-40 rounded-sm bg-iron p-6">
              <h2 className="text-sm font-semibold text-bone">Debug logs</h2>
              {logs.length ? (
                <ol className="mt-4 space-y-1 font-mono text-xs text-steel">
                  {logs.map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ol>
              ) : (
                <p className="mt-8 text-center text-sm text-ash">No logs yet.</p>
              )}
            </section>
          </div>
        </form>
      )}
    </div>
  );
}

/** The run control doubles as the wallet gate — one button, four states. */
function RunButton({ agent, busy }: { agent: Agent; busy: boolean }) {
  const wallet = useWallet();
  const base =
    "mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-iron";

  if (!wallet.installed) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer noopener"
        className={`${base} border border-brass/40 text-bone hover:border-brass`}
      >
        <Wallet className="size-4" aria-hidden />
        Install MetaMask to run
      </a>
    );
  }

  if (!wallet.account) {
    return (
      <button
        type="button"
        onClick={() => void wallet.connect()}
        disabled={wallet.busy}
        className={`${base} bg-ember text-soot disabled:opacity-60`}
      >
        <Wallet className="size-4" aria-hidden />
        {wallet.busy ? "Connecting…" : "Connect wallet to run"}
      </button>
    );
  }

  if (wallet.wrongChain) {
    return (
      <button
        type="button"
        onClick={() => void wallet.switchChain()}
        disabled={wallet.busy}
        className={`${base} bg-ember text-soot disabled:opacity-60`}
      >
        <TriangleAlert className="size-4" aria-hidden />
        Switch to Monad Testnet
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      className={`${base} bg-ember text-soot disabled:opacity-60`}
    >
      {busy ? "Running…" : `Sign to pay ${agent.price} ANVL — no gas required`}
    </button>
  );
}
