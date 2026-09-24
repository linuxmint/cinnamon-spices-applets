import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/gjs-mock.ts"],
    include: ["test/**/*.test.ts"],
  },
});
