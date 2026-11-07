import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Match Next.js: JSX (chat cards) compiles with the automatic runtime.
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"], testTimeout: 20000 },
});
