import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3520);
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The E2E server runs a production build against its own database and uploads folder, so a run
 * never touches the development data in `data/ikizen.db`. `db:reset` rebuilds and reseeds it first.
 */
const serverEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "file:./data/e2e.db",
  UPLOADS_DIR: "./data/e2e-uploads",
  BETTER_AUTH_URL: BASE_URL,
  BETTER_AUTH_SECRET: "e2e-only-secret-value-that-is-long-enough-1234567890",
  SMTP_HOST: "",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // Optional: run against a system Chromium when the bundled browser cannot be downloaded.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    command: `pnpm db:reset && pnpm build && pnpm exec next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    env: serverEnv,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
