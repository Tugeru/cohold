import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loadingSources = [
  "./(demo)/loading.tsx",
  "./(demo)/overview/loading.tsx",
  "./(demo)/treasuries/loading.tsx",
  "./(demo)/treasuries/[id]/loading.tsx",
  "./(demo)/proposals/loading.tsx",
  "./(demo)/proposals/[id]/loading.tsx",
  "./(demo)/activity/loading.tsx",
  "./(demo)/wallet/loading.tsx",
  "./(demo)/settings/loading.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
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
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

describe("demo route boundaries", () => {
  it("uses a page-appropriate skeleton for every demo route boundary", () => {
    for (const source of loadingSources) {
      expect(source).toMatch(/Skeleton/);
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
    for (const source of modalSources) {
      expect(source).toContain("useModalA11y");
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
    }
  });
});
