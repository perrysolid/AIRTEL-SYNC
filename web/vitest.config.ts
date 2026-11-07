import { defineConfig } from "vitest/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Tests write orders and sessions; keep them out of the developer's real .data store.
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-vitest-"));

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { env: { STORE_DIR: storeDir }, environment: "node", include: ["src/**/*.test.ts"], testTimeout: 20000 },
});
