"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CircleDollarSign,
  Copy,
  ExternalLink,
  House,
  IdCard,
  KeyRound,
  LogOut,
  MessageCircle,
  Plus,
  TriangleAlert,
  Wallet,
  Workflow,
} from "lucide-react";
import { WalletProvider, useWallet } from "@/components/wallet-provider";
import { EXPLORER, FAUCET, formatToken, shortAddr } from "@/lib/wallet";

const nav = [
  { href: "/", label: "Store", icon: House, soon: false },
  { href: "/workflows", label: "Workflows", icon: Workflow, soon: false },
  { href: "/identity", label: "Identity", icon: IdCard, soon: false },
  { href: "/stake", label: "Stake", icon: CircleDollarSign, soon: false },
  { href: "/keys", label: "Deploy keys", icon: KeyRound, soon: false },
];

function WalletChip() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!wallet.installed) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer noopener"
        className="flex min-h-10 items-center gap-2 rounded-sm border border-brass/40 px-3 text-sm text-bone hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        <Wallet className="size-4" aria-hidden />
        Install MetaMask
      </a>
    );
  }

  if (!wallet.account) {
    return (
      <button
        type="button"
        onClick={() => void wallet.connect()}
        disabled={wallet.busy}
        className="flex min-h-10 items-center gap-2 rounded-sm border border-brass/40 px-3 text-sm text-bone hover:border-brass disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        <Wallet className="size-4" aria-hidden />
        {wallet.busy ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-10 items-center gap-2 rounded-sm border border-brass/25 px-3 text-sm hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        <span
          className={`size-2 rounded-full ${
            wallet.wrongChain ? "bg-ember" : "bg-emerald-500"
          }`}
          aria-hidden
        />
        <span className="font-mono text-bone">{shortAddr(wallet.account)}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-60 rounded-sm border border-brass/25 bg-iron p-1 shadow-lg shadow-black/40"
        >
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await navigator.clipboard.writeText(wallet.account ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 text-left text-sm text-steel hover:bg-slag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <Copy className="size-4" aria-hidden />
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            role="menuitem"
            href={`${EXPLORER}/address/${wallet.account}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 text-sm text-steel hover:bg-slag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <ExternalLink className="size-4" aria-hidden />
            View on explorer
          </a>
          <a
            role="menuitem"
            href={FAUCET}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 text-sm text-steel hover:bg-slag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <CircleDollarSign className="size-4" aria-hidden />
            Get testnet MON
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              wallet.disconnect();
              setOpen(false);
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-sm px-3 text-left text-sm text-steel hover:bg-slag focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          >
            <LogOut className="size-4" aria-hidden />
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TopBar() {
  const wallet = useWallet();
  const anvl = wallet.balances?.anvl;
  const mon = wallet.balances?.mon;
  // Prefer showing $ANVL; fall back to MON if $ANVL hasn't loaded yet, and to
  // nothing at all only if neither has ever successfully loaded.
  const shown = anvl != null ? { value: anvl, unit: "ANVL" } : mon != null ? { value: mon, unit: "MON" } : null;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-3 border-b border-brass/20 bg-iron/95 px-4 backdrop-blur">
      {wallet.wrongChain ? (
        <button
          type="button"
          onClick={() => void wallet.switchChain()}
          disabled={wallet.busy}
          className="flex min-h-10 items-center gap-2 rounded-sm bg-ember px-3 text-sm font-semibold text-soot disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          <TriangleAlert className="size-4" aria-hidden />
          Wrong network · Switch
        </button>
      ) : null}

      {wallet.account && shown ? (
        <p className="hidden font-mono text-sm text-ash sm:block">
          <span className="text-bone">{formatToken(shown.value)}</span> {shown.unit}
        </p>
      ) : null}

      <WalletChip />
    </header>
  );
}

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-brass/20 bg-iron lg:w-64">
      <Link
        href="/"
        className="flex h-14 items-center gap-2 px-3 font-display text-lg font-extrabold text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        <span aria-hidden>⚒️</span>
        <span className="hidden lg:inline">Anvil</span>
        <span className="ml-auto hidden rounded-full border border-brass/40 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-brass lg:inline">
          Testnet
        </span>
      </Link>

      <button
        type="button"
        disabled
        className="mx-2 mb-4 hidden min-h-10 items-center justify-center gap-2 rounded-sm bg-ember px-3 text-sm font-semibold text-soot opacity-70 lg:flex"
      >
        <Plus className="size-4" aria-hidden />
        Add workflow
        <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-soot/70">
          Soon
        </span>
      </button>

      <p className="mb-2 hidden px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-ash lg:block">
        Main menu
      </p>
      <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Main">
        {nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          if (item.soon) {
            return (
              <span
                key={item.href}
                className="flex min-h-10 items-center gap-3 rounded-sm px-2 text-ash"
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-between">
                  {item.label}
                  <span className="text-[10px] uppercase tracking-wide text-brass">
                    Soon
                  </span>
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-sm px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                active ? "bg-slag text-bone" : "text-steel hover:bg-slag/60"
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        disabled
        className="m-2 flex min-h-10 items-center gap-3 rounded-sm px-2 text-ash"
      >
        <MessageCircle className="size-5 shrink-0" aria-hidden />
        <span className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-between">
          AI Assistant
          <span className="text-[10px] uppercase tracking-wide text-brass">
            Soon
          </span>
        </span>
      </button>
    </aside>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="flex min-h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </WalletProvider>
  );
}
