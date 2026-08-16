"use client";

import { useState } from "react";
import { ExternalLink, TriangleAlert, Wallet, Workflow as WorkflowIcon } from "lucide-react";
import type { Agent } from "@/data/agents";
import { callPaidAPI } from "@/lib/m402";
import { useWallet } from "@/components/wallet-provider";
import { shortAddr } from "@/lib/wallet";

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

/** The one workflow output shape this page knows how to render specially — anything else falls back to raw JSON. */
type ZeptoCartOutput = {
  workflow: "zepto-cart-v1";
  status: "ready_for_checkout" | "partial";
  items: Array<{ title: string; quantity: number; unitPrice: number | null; lineTotal: number | null }>;
  total: number;
  currency: string;
  checkout: {
    available: boolean;
    type: "zepto_session" | "login_required" | "unavailable";
    url?: string;
    label: string;
  };
  failures: Array<{ query: string; reason: string }>;
};

function isZeptoCartOutput(value: unknown): value is ZeptoCartOutput {
  return Boolean(value) && typeof value === "object" && (value as { workflow?: unknown }).workflow === "zepto-cart-v1";
}

export function WorkflowDetail({ agent }: { agent: Agent }) {
  const wallet = useWallet();
  const [value, setValue] = useState("");
  const [output, setOutput] = useState<unknown>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const param = agent.params[0];

  async function onRun(event: React.FormEvent) {
    event.preventDefault();
    if (param?.required && !value.trim()) {
      setError(`${param.name} is required`);
      return;
    }
    setBusy(true);
    setError(null);
    setOutput(null);
    setSettlement(null);

    const signer = wallet.signer();
    setLogs([
      `Paying as ${shortAddr(signer.payer)}`,
      "Requesting workflow…",
      "Waiting for signature in your wallet…",
    ]);

    try {
      const paid = await callPaidAPI<Record<string, string>, RunResponse>(
        `/api/agents/${agent.id}/send`,
        { [param?.name ?? "request"]: value },
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
      const rejected =
        (err as { code?: number })?.code === 4001 || /user rejected|denied/i.test(message);
      setError(rejected ? "You declined the signature — nothing was paid." : message);
      setLogs((prev) => [...prev, rejected ? "Signature declined" : "Failed"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-ash">Workflows</p>
      <div className="mt-1 flex items-center gap-2">
        <WorkflowIcon className="size-6 text-ember" aria-hidden />
        <h1 className="font-display text-3xl font-extrabold text-bone">{agent.name}</h1>
      </div>
      <p className="mt-3 max-w-prose text-steel">{agent.description}</p>

      <form onSubmit={onRun} className="mt-8 space-y-4 rounded-sm bg-iron p-6">
        {param ? (
          <div>
            <label htmlFor={param.name} className="block text-sm font-semibold text-bone">
              {param.description}
            </label>
            <textarea
              id={param.name}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={param.example}
              rows={2}
              className="mt-2 w-full rounded-sm border border-brass/30 bg-slag px-3 py-2 text-sm text-bone placeholder:text-ash/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            />
          </div>
        ) : null}
        <WorkflowRunButton agent={agent} busy={busy} />
        <p className="text-center text-xs text-ash">
          You sign a message, not a transaction. No MON needed to run a workflow.
        </p>
      </form>

      <section className="mt-6 min-h-40 rounded-sm bg-iron p-6">
        <h2 className="text-sm font-semibold text-bone">Result</h2>
        {error ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : output ? (
          <>
            {isZeptoCartOutput(output) ? <ZeptoCartSummary output={output} /> : null}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-ash hover:text-bone">Raw output</summary>
              <pre className="mt-2 overflow-x-auto font-mono text-xs leading-5 text-steel">
                {JSON.stringify(output, null, 2)}
              </pre>
            </details>
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
            ) : null}
          </>
        ) : (
          <p className="mt-8 text-center text-sm text-ash">Waiting for a run.</p>
        )}
      </section>

      <section className="mt-6 min-h-32 rounded-sm bg-iron p-6">
        <h2 className="text-sm font-semibold text-bone">Steps</h2>
        {logs.length ? (
          <ol className="mt-4 space-y-1 font-mono text-xs text-steel">
            {logs.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ol>
        ) : (
          <p className="mt-8 text-center text-sm text-ash">No run yet.</p>
        )}
      </section>
    </div>
  );
}

/**
 * Cart summary + the one action this workflow is allowed to trigger: bringing
 * the real Zepto session forward. Never pays, never places the order — Zepto
 * owns checkout, address, and payment from here on.
 */
function ZeptoCartSummary({ output }: { output: ZeptoCartOutput }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const loginRequired = output.checkout.type === "login_required";

  async function onContinue() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/agents/zepto-cart-v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: loginRequired ? "login" : "checkout" }),
      });
      const data = (await res.json()) as { ok: boolean; stage?: string; message?: string };
      setStatus(
        data.ok
          ? `Opened in the Zepto browser session${data.stage ? ` (${data.stage})` : ""}.`
          : (data.message ?? "Could not open the Zepto session."),
      );
    } catch {
      setStatus("Could not reach the Zepto session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-sm border border-brass/30 bg-slag p-4">
      <h3 className="text-sm font-semibold text-bone">
        🛒 Zepto Cart {output.status === "ready_for_checkout" ? "Ready" : "— Partial"}
      </h3>
      <ul className="mt-3 space-y-1 text-sm text-steel">
        {output.items.map((item) => (
          <li key={item.title} className="flex justify-between gap-4">
            <span>
              {item.quantity} × {item.title}
            </span>
            <span className="text-bone">{item.lineTotal != null ? `₹${item.lineTotal}` : "—"}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-brass/20 pt-2 text-sm font-semibold">
        <span className="text-ash">Total</span>
        <span className="text-bone">
          {output.currency} {output.total}
        </span>
      </div>
      <p className="mt-2 text-xs text-ash">
        ✓ {output.items.length} product{output.items.length === 1 ? "" : "s"} added · ✓ Cart verified
      </p>
      {output.failures.length > 0 ? (
        <p className="mt-1 text-xs text-red-400">Could not add: {output.failures.map((f) => f.query).join(", ")}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void onContinue()}
        disabled={busy || output.checkout.type === "unavailable"}
        className="mt-4 flex min-h-10 w-full items-center justify-center rounded-sm bg-ember text-sm font-semibold text-soot disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        {busy ? "Opening…" : loginRequired ? output.checkout.label : `${output.checkout.label} →`}
      </button>
      {output.checkout.url ? (
        <a
          href={output.checkout.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 block text-center text-xs text-ash hover:text-bone"
        >
          {output.checkout.url}
        </a>
      ) : null}
      {status ? <p className="mt-2 text-center text-xs text-ash">{status}</p> : null}
      <p className="mt-3 text-center text-xs text-ash">
        Anvil never places the order — you complete address, delivery slot, and payment on Zepto.
      </p>
    </div>
  );
}

/** The run control doubles as the wallet gate — one button, four states. */
function WorkflowRunButton({ agent, busy }: { agent: Agent; busy: boolean }) {
  const wallet = useWallet();
  const base =
    "flex min-h-11 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-iron";

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
    <button type="submit" disabled={busy} aria-busy={busy} className={`${base} bg-ember text-soot disabled:opacity-60`}>
      {busy ? "Running…" : `Sign to pay ${agent.price} ANVL — no gas required`}
    </button>
  );
}
