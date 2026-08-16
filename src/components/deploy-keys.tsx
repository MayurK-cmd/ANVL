"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2, TriangleAlert } from "lucide-react";

export type PublicKey = {
  id: string;
  label: string;
  tail: string;
  createdAt: string;
  lastUsedAt?: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * The list is seeded by the server component that renders this, so there is no
 * fetch-on-mount and no loading state. Mutations patch it in place.
 */
export function DeployKeys({
  initialKeys,
  envKeySet,
}: {
  initialKeys: PublicKey[];
  envKeySet: boolean;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<{ key: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "could not create key");
      setFresh({ key: body.key, label: body.record.label });
      setKeys((prev) => [body.record as PublicKey, ...prev]);
      setLabel("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not create key");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, name: string) {
    if (!confirm(`Revoke "${name}"? Any deploy still using it will start failing.`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("could not revoke that key");
      setKeys((prev) => prev.filter((key) => key.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not revoke that key");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-2xl font-extrabold text-bone">Deploy keys</h1>
      <p className="mt-2 max-w-prose text-sm text-steel">
        A deploy key authenticates{" "}
        <code className="rounded-sm bg-slag px-1 font-mono text-bone">anvil deploy</code> against
        this Store. Create one here, then pass it with{" "}
        <code className="rounded-sm bg-slag px-1 font-mono text-bone">-k</code>.
      </p>

      <form onSubmit={create} className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="key-label" className="sr-only">
          Key label
        </label>
        <input
          id="key-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="What is this key for? e.g. laptop"
          maxLength={60}
          className="min-h-10 flex-1 rounded-sm border border-brass/25 bg-iron px-3 text-sm text-bone placeholder:text-ash focus-visible:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-10 items-center gap-2 rounded-sm bg-ember px-4 text-sm font-semibold text-soot disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          <Plus className="size-4" aria-hidden />
          {busy ? "Creating…" : "Create key"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-ember">
          {error}
        </p>
      ) : null}

      {fresh ? (
        <div className="mt-6 rounded-sm border border-ember/50 bg-ember/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-bone">
            <TriangleAlert className="size-4 text-ember" aria-hidden />
            Copy it now — this is the only time it is shown.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-sm bg-soot px-3 py-2 font-mono text-sm text-bone">
              {fresh.key}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh.key);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="flex min-h-10 items-center gap-2 rounded-sm border border-brass/40 px-3 text-sm text-bone hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 font-mono text-xs text-ash">
            anvil deploy -k {fresh.key.slice(0, 12)}…
          </p>
          <button
            type="button"
            onClick={() => setFresh(null)}
            className="mt-3 text-sm text-steel underline underline-offset-4 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            I&apos;ve saved it
          </button>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ash">
          Active keys
        </h2>

        {envKeySet ? (
          <p className="mt-3 rounded-sm border border-brass/25 bg-iron p-3 text-sm text-steel">
            <code className="font-mono text-bone">ANVIL_DEPLOY_KEY</code> is also set in the
            environment and keeps working. It cannot be revoked from here — remove it from{" "}
            <code className="font-mono text-bone">.env</code> instead.
          </p>
        ) : null}

        {keys.length === 0 ? (
          <p className="mt-3 text-sm text-ash">
            No keys yet. Deploys are rejected with 503 until one exists.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-brass/15 rounded-sm border border-brass/20">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-3 p-3">
                <KeyRound className="size-4 shrink-0 text-brass" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-bone">{key.label}</p>
                  <p className="font-mono text-xs text-ash">
                    anvil_…{key.tail} · created {when(key.createdAt)}
                    {key.lastUsedAt ? ` · last used ${when(key.lastUsedAt)}` : " · never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revoke(key.id, key.label)}
                  aria-label={`Revoke ${key.label}`}
                  className="flex min-h-10 items-center gap-2 rounded-sm border border-brass/25 px-3 text-sm text-steel hover:border-ember hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
                >
                  <Trash2 className="size-4" aria-hidden />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
