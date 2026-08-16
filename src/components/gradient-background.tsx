"use client";

import { usePathname } from "next/navigation";

/**
 * Fixed behind every page (mounted once in ShellModern) except the landing
 * page, which uses <LandingVideoBackground> instead. Purple + mint, per the
 * design system — kept low-opacity and heavily blurred so it reads as
 * ambient light, not a "crypto dashboard" gradient wash.
 */
export function GradientBackground() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute -top-48 left-[12%] size-[560px] rounded-full bg-primary/[0.16] blur-[130px]" />
      <div className="absolute top-1/4 -right-40 size-[480px] rounded-full bg-success/[0.14] blur-[130px]" />
      <div className="absolute bottom-[-180px] left-[6%] size-[420px] rounded-full bg-primary-light blur-[120px]" />
    </div>
  );
}
