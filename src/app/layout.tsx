import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import { ShellModern } from "@/components/shell-modern";
import "./globals.css";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anvil — Agent Store",
  description: "Browse and run M402-paid AI agents. Local MVP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${robotoMono.variable}`}>
      <body className="min-h-full">
        <ShellModern>{children}</ShellModern>
      </body>
    </html>
  );
}
