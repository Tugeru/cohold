import type { Metadata } from "next";
import { WalletProvider } from "@/context/WalletContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cohold — Shared funds. Shared control.",
  description:
    "Shared treasury and approval-based spending platform powered by Stellar Soroban smart contracts. Shared money requires shared permission.",
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  openGraph: {
    title: "Cohold — Shared funds. Shared control.",
    description: "Shared money requires shared permission.",
    images: [{ url: "/logo.png" }],
  },
  twitter: {
    card: "summary",
    title: "Cohold — Shared funds. Shared control.",
    description: "Shared money requires shared permission.",
    images: ["/logo.png"],
  },
  manifest: "/manifest.json", // if we add it
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body suppressHydrationWarning className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}