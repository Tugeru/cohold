import { describe, expect, it } from "vitest";
import {
  APP_NAV,
  APP_ROUTES,
  createTreasuryHref,
  navKeyFromPathname,
  shouldOpenCreateTreasury,
} from "./app-routes";

describe("APP_ROUTES", () => {
  it("exposes every MVP surface as a URL", () => {
    expect(APP_ROUTES.home).toBe("/");
    expect(APP_ROUTES.overview).toBe("/overview");
    expect(APP_ROUTES.treasuries).toBe("/treasuries");
    expect(APP_ROUTES.treasury("tr-it")).toBe("/treasuries/tr-it");
    expect(APP_ROUTES.proposals).toBe("/proposals");
    expect(APP_ROUTES.proposal("prop-venue")).toBe("/proposals/prop-venue");
    expect(APP_ROUTES.activity).toBe("/activity");
    expect(APP_ROUTES.wallet).toBe("/wallet");
    expect(APP_ROUTES.settings).toBe("/settings");
  });

  it("lists one nav item per app surface", () => {
    expect(APP_NAV.map((item) => item.key)).toEqual([
      "overview",
      "treasuries",
      "proposals",
      "activity",
      "wallet",
    ]);
    expect(APP_NAV.map((item) => item.href)).toEqual([
      "/overview",
      "/treasuries",
      "/proposals",
      "/activity",
      "/wallet",
    ]);
  });
});

describe("navKeyFromPathname", () => {
  it("maps list and detail URLs to the same nav key", () => {
    expect(navKeyFromPathname("/overview")).toBe("overview");
    expect(navKeyFromPathname("/treasuries")).toBe("treasuries");
    expect(navKeyFromPathname("/treasuries/tr-it")).toBe("treasuries");
    expect(navKeyFromPathname("/proposals")).toBe("proposals");
    expect(navKeyFromPathname("/proposals/prop-venue")).toBe("proposals");
    expect(navKeyFromPathname("/activity")).toBe("activity");
    expect(navKeyFromPathname("/wallet")).toBe("wallet");
    expect(navKeyFromPathname("/settings")).toBe("wallet");
  });

  it("does not treat the public landing as an app nav item", () => {
    expect(navKeyFromPathname("/")).toBeNull();
    expect(navKeyFromPathname("/unknown")).toBeNull();
  });
});

describe("create treasury demo path", () => {
  it("keeps Create Treasury on the demo overview route", () => {
    expect(createTreasuryHref()).toBe("/overview?create=1");
  });

  it("opens the modal only for the explicit demo query", () => {
    expect(shouldOpenCreateTreasury("1")).toBe(true);
    expect(shouldOpenCreateTreasury("true")).toBe(false);
    expect(shouldOpenCreateTreasury(null)).toBe(false);
  });
});
