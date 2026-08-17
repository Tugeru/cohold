import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const landingSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("public landing", () => {
  it("is a server component with no Freighter or window access", () => {
    expect(landingSource).not.toMatch(/["']use client["']/);
    expect(landingSource).not.toMatch(/\bwindow\b/);
    expect(landingSource).not.toMatch(/freighter/i);
    expect(landingSource).not.toMatch(/WalletProvider/);
  });

  it("offers View Demo and Create Treasury on the demo path", () => {
    expect(landingSource).toContain("View Demo");
    expect(landingSource).toContain("Create Treasury");
    expect(landingSource).toContain("createTreasuryHref");
    expect(landingSource).toContain("APP_ROUTES.overview");
  });
  it("offers a configured-treasury path in wallet mode", () => {
    expect(landingSource).toContain("Open Treasuries");
    expect(landingSource).toContain("coholdConfig.modeConfigured");
    expect(landingSource).toContain("APP_ROUTES.treasuries");
  });
});
