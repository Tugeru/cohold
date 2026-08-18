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

  it("hosts the persona connect island as the demo entry", () => {
    expect(landingSource).toContain("<LandingConnect />");
    expect(landingSource).not.toContain("View Demo");
    expect(landingSource).not.toContain("createTreasuryHref");
    expect(landingSource).not.toContain("APP_ROUTES.overview");
  });
  it("hosts the single connect island in wallet mode too", () => {
    expect(landingSource).toContain("<LandingConnect />");
    expect(landingSource).not.toContain("Open Treasuries");
    expect(landingSource).not.toContain("Open Wallet");
    expect(landingSource).not.toContain("APP_ROUTES");
  });
});
