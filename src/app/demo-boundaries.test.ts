import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loadingSources = [
  ["DemoLoading", "OverviewSkeleton", "./(demo)/loading.tsx"],
  ["OverviewLoading", "OverviewSkeleton", "./(demo)/overview/loading.tsx"],
  ["TreasuriesLoading", "TreasuryListSkeleton", "./(demo)/treasuries/loading.tsx"],
  ["TreasuryDetailLoading", "DetailSkeleton", "./(demo)/treasuries/[id]/loading.tsx"],
  ["ProposalsLoading", "ProposalListSkeleton", "./(demo)/proposals/loading.tsx"],
  ["ProposalDetailLoading", "DetailSkeleton", "./(demo)/proposals/[id]/loading.tsx"],
  ["ActivityLoading", "ActivitySkeleton", "./(demo)/activity/loading.tsx"],
  ["WalletLoading", "SettingsSkeleton", "./(demo)/wallet/loading.tsx"],
  ["SettingsLoading", "SettingsSkeleton", "./(demo)/settings/loading.tsx"],
].map(([exportName, skeletonName, path]) => ({
  exportName,
  skeletonName,
  source: readFileSync(new URL(path, import.meta.url), "utf8"),
}));
const errorSource = readFileSync(
  new URL("./(demo)/error.tsx", import.meta.url),
  "utf8",
);
const environmentBadgeSource = readFileSync(
  new URL("../components/EnvironmentBadge.tsx", import.meta.url),
  "utf8",
);
const demoShellSource = readFileSync(
  new URL("../components/DemoShell.tsx", import.meta.url),
  "utf8",
);
const connectScreenSource = readFileSync(
  new URL("../components/ConnectScreen.tsx", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);
const overviewSource = readFileSync(
  new URL("./(demo)/overview/page.tsx", import.meta.url),
  "utf8",
);
const modalExports = [
  ["../components/ContributeModal.tsx", "ContributeModal"],
  ["../components/CreateProposalModal.tsx", "CreateProposalModal"],
  ["../components/CreateTreasuryModal.tsx", "CreateTreasuryModal"],
  ["../components/DemoTourModal.tsx", "DemoTourModal"],
  ["../components/ExecutionConfirmDialog.tsx", "ExecutionConfirmDialog"],
  ["../components/WalletContributeDialog.tsx", "WalletContributeDialog"],
  ["../components/WalletProposalDialogs.tsx", "WalletCreateProposalDialog"],
  ["../components/WalletProposalDialogs.tsx", "WalletApproveDialog"],
  ["../components/WalletProposalDialogs.tsx", "WalletExecuteDialog"],
  ["../components/WalletCreateTreasuryDialog.tsx", "WalletCreateTreasuryDialog"],
] as const;
const modalSources = modalExports.map(([path, exportName]) => {
  const fullSource = readFileSync(new URL(path, import.meta.url), "utf8");
  const start = fullSource.indexOf(`export function ${exportName}`);
  const next = fullSource.indexOf("\nexport function ", start + 1);
  return {
    path: `${path}#${exportName}`,
    source: fullSource.slice(start, next === -1 ? undefined : next),
  };
});

describe("demo route boundaries", () => {
  it("uses the declared skeleton for every demo route boundary", () => {
    for (const { exportName, skeletonName, source } of loadingSources) {
      expect(source).toContain(`function ${exportName}`);
      expect(source).toContain(`return <${skeletonName}`);
    }
  });

  it("offers a retry boundary without claiming financial state changed", () => {
    expect(errorSource).toContain('"use client"');
    expect(errorSource).toContain("ResourceStatus");
    expect(errorSource).toContain("reset");
    expect(errorSource).toContain("No financial state was changed");
  });

  it("announces the environment badge as a status", () => {
    expect(environmentBadgeSource).toContain('role="status"');
    expect(environmentBadgeSource).toContain("aria-label={getEnvironmentLabel()}");
  });

  it("gives every financial modal a local focus trap", () => {
    for (const { path, source } of modalSources) {
      expect(source, path).toContain("useModalA11y");
      expect(source, path).toContain("ref={dialogRef}");
      expect(source, path).toContain('role="dialog"');
      expect(source, path).toContain('aria-modal="true"');
    }
  });

  it("gates the dashboard shell behind the identity check", () => {
    expect(demoShellSource).toContain("import { ConnectScreen }");
    expect(demoShellSource).toContain("authBlockReason !== null");
    expect(demoShellSource).toContain("return <ConnectScreen />");
  });

  it("performs a real on-chain deploy from the create-treasury dialog", () => {
    const dialogSource = readFileSync(
      new URL("../components/WalletCreateTreasuryDialog.tsx", import.meta.url),
      "utf8",
    );
    // The dialog drives the deploy flow and registers the new contract id;
    // it must never regress to CLI/env-copying instructions.
    expect(dialogSource).toContain("createTreasuryDeployFlow");
    expect(dialogSource).toContain("stellarTreasuryDeployExecutor");
    expect(dialogSource).toContain("registerTreasury");
    expect(dialogSource).not.toContain("npm run testnet:bootstrap");
    expect(dialogSource).not.toContain("NEXT_PUBLIC_STELLAR_CONTRACT_ID");
  });

  it("routes to the mode-aware dashboard once identity is established", () => {
    expect(connectScreenSource).toContain("router.replace");
    expect(connectScreenSource).toContain("APP_ROUTES.overview");
    expect(connectScreenSource).toContain("const dashboardRoute = APP_ROUTES.overview");
    expect(connectScreenSource).toContain("PersonaPickList");
  });

  it("renders a chain-driven wallet overview instead of the demo gate in wallet mode", () => {
    expect(overviewSource).toContain("import { WalletOverviewView }");
    expect(overviewSource).toContain('coholdConfig.mode === "wallet"');
    expect(overviewSource).toContain("return <WalletOverviewView />");
    expect(overviewSource).toContain("import { DemoGate }");
  });

  it("hosts the connect island on the public landing page", () => {
    expect(landingSource).toContain("import { LandingConnect }");
    expect(landingSource).toContain("<LandingConnect />");
  });
});
