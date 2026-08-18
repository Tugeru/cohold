import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "cohold-contract": new URL(
        "./packages/cohold-contract/src/index.ts",
        import.meta.url,
      ).pathname,
      "cohold-factory-contract": new URL(
        "./packages/cohold-factory-contract/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
