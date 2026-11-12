import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        "postgresql://rms@127.0.0.1:5432/binary_member_portal_test?schema=public",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
