"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Hammer,
  IdCard,
  KeyRound,
  LogOut,
  TriangleAlert,
  Wallet,
  Workflow,
} from "lucide-react";
import { GradientBackground } from "@/components/gradient-background";
import { LandingHeader } from "@/components/landing-header";
import { WalletProvider, useWallet } from "@/components/wallet-provider";
import { EXPLORER, FAUCET, formatToken, shortAddr } from "@/lib/wallet";

const nav = [
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/stake", label: "Stake", icon: CircleDollarSign },
  { href: "/identity", label: "Identity", icon: IdCard },
  { href: "/keys", label: "Deploy keys", icon: KeyRound },
];

const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 84;
const SIDEBAR_COLLAPSE_KEY = "anvil.sidebar.collapsed";

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
      <a href="https://metamask.io/download/" target="_blank" rel="noreferrer noopener" className="ui-button ui-button-secondary">
        <Wallet className="size-4" aria-hidden />
        Install MetaMask
      </a>
    );
  }

  if (!wallet.account) {
    return (
      <button type="button" onClick={() => void wallet.connect()} disabled={wallet.busy} className="ui-button ui-button-primary disabled:opacity-60">
        <Wallet className="size-4" aria-hidden />
        {wallet.busy ? "Connecting..." : "Connect wallet"}
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
        className="ui-card flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 hover:border-primary/40"
      >
        <span className={`size-2.5 rounded-full ${wallet.wrongChain ? "bg-danger" : "bg-success"}`} aria-hidden />
        <span className="text-left leading-tight">
          <span className="block font-mono text-sm text-ink">{shortAddr(wallet.account)}</span>
          <span className="block text-xs text-muted">
            {wallet.wrongChain ? "Wrong network" : "Monad Testnet"}
          </span>
        </span>
      </button>

      {open ? (
        <div role="menu" className="ui-card absolute right-0 z-20 mt-2 w-72 rounded-2xl p-2">
          <div className="px-3 py-2">
            <p className="font-mono text-sm text-ink">{shortAddr(wallet.account)}</p>
            <p className="mt-1 text-xs text-copy">Wallet controls and explorer links</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await navigator.clipboard.writeText(wallet.account ?? "");
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-copy hover:bg-surface"
          >
            <Copy className="size-4" aria-hidden />
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            role="menuitem"
            href={`${EXPLORER}/address/${wallet.account}`}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-copy hover:bg-surface"
          >
            <ExternalLink className="size-4" aria-hidden />
            View on explorer
          </a>
          <a
            role="menuitem"
            href={FAUCET}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-copy hover:bg-surface"
          >
            <ArrowUpRight className="size-4" aria-hidden />
            Get testnet MON
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              wallet.disconnect();
              setOpen(false);
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm text-copy hover:bg-surface"
          >
            <LogOut className="size-4" aria-hidden />
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Header() {
  const wallet = useWallet();
  const anvl = wallet.balances?.anvl;
  const mon = wallet.balances?.mon;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-white/90 backdrop-blur-xl">
      <div className="page-shell flex min-h-18 items-center gap-4 py-4">
        <Link href="/" className="flex items-center gap-3 lg:hidden">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Hammer className="size-5" aria-hidden />
          </span>
          <span className="flex flex-col">
            <span className="text-base font-semibold text-ink">Anvil</span>
            <span className="text-xs text-muted">AI agents as assets</span>
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {wallet.account && anvl != null ? (
            <div className="ui-card flex min-h-11 items-center gap-3 rounded-xl px-3 py-2">
              <span className="ui-pill ui-pill-primary">{formatToken(anvl)} ANVL</span>
              {mon != null ? <span className="text-sm text-copy">{formatToken(mon)} MON</span> : null}
            </div>
          ) : null}
          <WalletChip />
        </div>
      </div>

      <div className="page-shell flex justify-end pb-4 md:hidden">
        <WalletChip />
      </div>

      {wallet.wrongChain ? (
        <div className="page-shell pb-4">
          <button
            type="button"
            onClick={() => void wallet.switchChain()}
            disabled={wallet.busy}
            className="ui-button ui-pill-danger w-full justify-center rounded-xl md:w-auto"
          >
            <TriangleAlert className="size-4" aria-hidden />
            Switch to Monad Testnet
          </button>
        </div>
      ) : null}

      <MobileNav />
    </header>
  );
}

/** The sidebar is desktop-only (`lg:` and up) — this covers navigation below that breakpoint. */
function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="page-shell flex gap-2 overflow-x-auto pb-3 lg:hidden"
    >
      {nav.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${
              active ? "bg-primary-light text-primary-dark" : "text-copy hover:bg-surface hover:text-ink"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/80 bg-white/95 backdrop-blur-xl lg:flex"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED, transition: "width 200ms ease" }}
    >
      <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Hammer className="size-5" aria-hidden />
          </span>
          {!collapsed ? <span className="whitespace-nowrap text-base font-semibold text-ink">Anvil</span> : null}
        </Link>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium ${collapsed ? "justify-center" : ""} ${
                active
                  ? "bg-primary-light text-primary-dark"
                  : "text-copy hover:bg-surface hover:text-ink"
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {!collapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        {!collapsed ? (
          <div className="mb-3 space-y-2">
            <span className="ui-pill ui-pill-success">Live on Monad</span>
            <span className="ui-pill">Monad Testnet</span>
          </div>
        ) : (
          <span className="mb-3 flex justify-center" title="Live on Monad">
            <span className="size-2.5 rounded-full bg-success" aria-hidden />
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`ui-button ui-button-secondary w-full !min-h-9 ${collapsed ? "px-0" : ""}`}
        >
          {collapsed ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
          {!collapsed ? "Collapse" : null}
        </button>
      </div>
    </aside>
  );
}

export function ShellModern({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isLanding = pathname === "/";

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  // The landing page is a full-bleed splash (its own video background) —
  // no header, no sidebar chrome. Every other route keeps the app shell.
  if (isLanding) {
    return (
      <WalletProvider>
        <LandingHeader />
        {children}
      </WalletProvider>
    );
  }

  return (
    <WalletProvider>
      <GradientBackground />
      <div className="min-h-full" style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className="with-sidebar-offset">
          <Header />
          <main className="page-shell min-w-0 py-8 md:py-10">{children}</main>
        </div>
      </div>
    </WalletProvider>
  );
}
