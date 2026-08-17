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
const modalSources = [
  "../components/ContractModal.tsx",
  "../components/ContributeModal.tsx",
  "../components/CreateProposalModal.tsx",
  "../components/CreateTreasuryModal.tsx",
  "../components/DemoTourModal.tsx",
  "../components/ExecutionConfirmDialog.tsx",
  "../components/WalletContributeDialog.tsx",
  "../components/WalletProposalDialogs.tsx",
].map((path) => ({
  path,
  source: readFileSync(new URL(path, import.meta.url), "utf8"),
}));

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
});
