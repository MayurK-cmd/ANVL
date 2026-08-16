import Link from "next/link";
import { BookOpen, Coins, Droplets, GitFork, Hammer } from "lucide-react";
import { EXPLORER, FAUCET } from "@/lib/format";

const ANVL_TOKEN = "0x538CDB64403a7b404270ce0a46EB6061107f5fb9";
const GITHUB_URL = "https://github.com/MayurK-cmd/ANVL";

const links = [
  { href: `${EXPLORER}/token/${ANVL_TOKEN}`, label: "ANVL token", icon: Coins },
  { href: FAUCET, label: "Faucet", icon: Droplets },
  { href: "/docs", label: "Docs", icon: BookOpen, internal: true },
];

export function LandingHeader() {
  return (
    <header className="relative z-10">
      <div className="page-shell flex h-20 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-[#0e0e14]">
            <Hammer className="size-5" aria-hidden />
          </span>
          <span className="text-base font-semibold text-ink">Anvil</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) =>
            link.internal ? (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-copy hover:bg-surface hover:text-ink"
              >
                <link.icon className="size-4" aria-hidden />
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-copy hover:bg-surface hover:text-ink"
              >
                <link.icon className="size-4" aria-hidden />
                {link.label}
              </a>
            ),
          )}
        </nav>

        <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener" className="ui-button ui-button-primary">
          <GitFork className="size-4" aria-hidden />
          GitHub
        </a>
      </div>
    </header>
  );
}
