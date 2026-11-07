import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Route pages and layouts are exercised by the Playwright tests, not unit tests.
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
      ],
      reporter: ["text", "html"],
      thresholds: {
        lines: 70,
        branches: 70,
        "src/challenges/**": { lines: 90, branches: 90 },
        "src/lib/scoring/**": { lines: 90, branches: 90 },
        "src/lib/streak/**": { lines: 90, branches: 90 },
        // Decides who may enter the prize draw.
        "src/lib/eligibility.ts": { lines: 90, branches: 90 },
        "src/lib/eligibilityFields.ts": { lines: 90, branches: 90 },
        // Gates account creation.
        "src/lib/signup.ts": { lines: 90, branches: 90 },
      },
    },
  },
});
