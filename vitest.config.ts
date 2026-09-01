import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  logLevel: "error",
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: [/@turnkey\//, /@liqpro\//] } },
  },
});
