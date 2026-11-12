import { defineConfig, devices } from "@playwright/test";

// `npm run test:e2e:local` uses another port (E2E_PORT), so a running `npm run dev` on 3000 is left alone.
const PORT = Number(process.env.E2E_PORT) || 3000;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  // Locally, opens every page once before the workers start (see the file).
  globalSetup: "./tests/e2e/global-setup.ts",
  // Playwright empties its output folder on every run; a subfolder keeps other files in test-results/.
  outputDir: "test-results/playwright",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: ["after/**", "mobile/**"] },
    // Phones (T47), on Chromium so CI installs no other browser; only the phone checks run here.
    { name: "pixel-7", use: { ...devices["Pixel 7"] }, testMatch: "mobile/**/*.spec.ts" },
    {
      name: "phone-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
      testMatch: "mobile/**/*.spec.ts",
    },
    // Tests that change today's game day for everyone (its challenge): only after the rest.
    { name: "after", use: { ...devices["Desktop Chrome"] }, testMatch: "after/**/*.spec.ts", dependencies: ["chromium"] },
  ],
  webServer: {
    // CI tests the production build; locally the dev server is faster to start and reuse.
    command: isCI ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // `npm run test:e2e:local` sets E2E_FRESH_SERVER: a dev server already on the port may have
    // been started with other keys, which would bypass that script's localhost check.
    reuseExistingServer: !isCI && !process.env.E2E_FRESH_SERVER,
    timeout: 180_000,
  },
});
