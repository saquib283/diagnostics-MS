import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const parsedUrl = new URL(baseURL);
const port = parsedUrl.port || "3000";
const hostname = parsedUrl.hostname || "127.0.0.1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx next start -p ${port} -H ${hostname}`,
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...(process.env as Record<string, string>),
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
