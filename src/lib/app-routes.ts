export const APP_ROUTES = {
  home: "/",
  overview: "/overview",
  treasuries: "/treasuries",
  treasury: (id: string) => `/treasuries/${id}`,
  proposals: "/proposals",
  proposal: (id: string) => `/proposals/${id}`,
  activity: "/activity",
  wallet: "/wallet",
  settings: "/settings",
} as const;

export type AppNavKey =
  | "overview"
  | "treasuries"
  | "proposals"
  | "activity"
  | "wallet";

export const APP_NAV: { key: AppNavKey; href: string; label: string }[] = [
  { key: "overview", href: APP_ROUTES.overview, label: "Overview" },
  { key: "treasuries", href: APP_ROUTES.treasuries, label: "Treasuries" },
  { key: "proposals", href: APP_ROUTES.proposals, label: "Proposals" },
  { key: "activity", href: APP_ROUTES.activity, label: "Activity" },
  { key: "wallet", href: APP_ROUTES.wallet, label: "Wallet & Settings" },
];

export function navKeyFromPathname(pathname: string): AppNavKey | null {
  if (pathname === APP_ROUTES.overview) return "overview";
  if (
    pathname === APP_ROUTES.treasuries ||
    pathname.startsWith(`${APP_ROUTES.treasuries}/`)
  ) {
    return "treasuries";
  }
  if (
    pathname === APP_ROUTES.proposals ||
    pathname.startsWith(`${APP_ROUTES.proposals}/`)
  ) {
    return "proposals";
  }
  if (pathname === APP_ROUTES.activity) return "activity";
  if (pathname === APP_ROUTES.wallet || pathname === APP_ROUTES.settings) {
    return "wallet";
  }
  return null;
}

export function createTreasuryHref(): string {
  return `${APP_ROUTES.overview}?create=1`;
}

export function shouldOpenCreateTreasury(value: string | null): boolean {
  return value === "1";
}

export function walletExplorerUrl(kind: "account" | "contract", id: string): string {
  return `https://stellar.expert/explorer/testnet/${kind}/${id}`;
}

/**
 * Wallet-mode proposal deep link. The treasury contract is carried in the
 * query so extra configured contracts never resolve against the primary one.
 * Demo mode uses `APP_ROUTES.proposal(id)` directly.
 */
export function walletProposalHref(proposalId: string, treasuryId: string): string {
  return `${APP_ROUTES.proposal(proposalId)}?treasury=${encodeURIComponent(treasuryId)}`;
}
