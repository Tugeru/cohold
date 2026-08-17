import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loadingSource = readFileSync(
  new URL("./(demo)/loading.tsx", import.meta.url),
  "utf8",
);
const errorSource = readFileSync(
  new URL("./(demo)/error.tsx", import.meta.url),
  "utf8",
);
const environmentBadgeSource = readFileSync(
  new URL("../components/EnvironmentBadge.tsx", import.meta.url),
  "utf8",
);

describe("demo route boundaries", () => {
  it("uses the application skeleton for route loading", () => {
    expect(loadingSource).toContain("OverviewSkeleton");
    expect(loadingSource).toContain("DemoLoading");
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
});
