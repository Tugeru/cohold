import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // fileURLToPath keeps the aliases valid on Windows too, where
      // URL.pathname yields an unusable "/C:/..." path.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "cohold-contract": fileURLToPath(
        new URL("./packages/cohold-contract/src/index.ts", import.meta.url),
      ),
      "cohold-factory-contract": fileURLToPath(
        new URL(
          "./packages/cohold-factory-contract/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
});
