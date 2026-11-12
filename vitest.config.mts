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
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.mts"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        // Route pages and layouts are exercised by the Playwright tests, not unit tests.
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
      ],
      // The summary only; the per-file table is in the HTML report. Missed thresholds still fail the run.
      reporter: ["text-summary", "html"],
      thresholds: {
        lines: 70,
        branches: 70,
        "src/challenges/**": { lines: 90, branches: 90 },
        "src/lib/scoring/**": { lines: 90, branches: 90 },
        // Matches nothing yet: the streak is computed in SQL (T21, T34). TypeScript streak logic,
        // for example the streak and history display in T24, belongs here.
        "src/lib/streak/**": { lines: 90, branches: 90 },
        // Start, submit and store scored attempts: who may play and what counts.
        "src/lib/attempts/**": { lines: 90, branches: 90 },
        // Which game date a moment belongs to, and its deadline.
        "src/lib/gameDay.ts": { lines: 90, branches: 90 },
        // The survival threshold and pass targets that pass/fail and the streak use.
        "src/lib/settings.ts": { lines: 90, branches: 90 },
        // The live pass rate players see, and when it hides.
        "src/lib/meter.ts": { lines: 90, branches: 90 },
        "src/lib/meterRead.ts": { lines: 90, branches: 90 },
        // Reads the numbers that pass/fail, the meter and the streak are computed from.
        "src/lib/db/**": { lines: 90, branches: 90 },
        // How much a cycle's winner is paid, and what rolls over.
        "src/lib/prize.ts": { lines: 90, branches: 90 },
        // Which attempts lose their prize entries.
        "src/lib/cheat/**": { lines: 90, branches: 90 },
        // Decides who may enter the prize draw.
        "src/lib/eligibility.ts": { lines: 90, branches: 90 },
        "src/lib/eligibilityFields.ts": { lines: 90, branches: 90 },
        // Decides who sees the admin page.
        "src/lib/admin.ts": { lines: 90, branches: 90 },
        "src/lib/adminEdit.ts": { lines: 90, branches: 90 },
        // Gates account creation.
        "src/lib/signup.ts": { lines: 90, branches: 90 },
        "src/lib/signin.ts": { lines: 90, branches: 90 },
        // Client components get component tests (Testing Library, jsdom per file).
        "src/app/signup/SignUpForm.tsx": { lines: 80, branches: 80 },
        "src/app/signin/SignInForm.tsx": { lines: 80, branches: 80 },
        // The scored and practice screens sit outside src/components/**.
        "src/app/play/PlayToday.tsx": { lines: 90, branches: 90 },
        "src/app/practice/stacking/StackingPractice.tsx": { lines: 90, branches: 90 },
        "src/components/**": { lines: 80, branches: 80 },
      },
    },
  },
});
