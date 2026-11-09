import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
