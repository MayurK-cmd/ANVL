/**
 * Pure display helpers with no DOM/window dependency — safe to import from
 * Server Components. `wallet.ts` is "use client" (it touches window.ethereum),
 * so anything a Server Component needs lives here instead, and `wallet.ts`
 * re-exports these for existing client-side callers.
 */

export const EXPLORER = "https://testnet.monadscan.com";
export const FAUCET = "https://faucet.monad.xyz";

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatToken(value: bigint, decimals = 18, places = 4): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = ((value % base) * 10n ** BigInt(places)) / base;
  return `${whole}.${frac.toString().padStart(places, "0")}`;
}
