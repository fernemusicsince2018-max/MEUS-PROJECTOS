import { defineConfig, devices } from "@playwright/test";

const useEdgeChannel = process.platform === "win32";
const baseURL = "http://localhost:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "smoke-browser",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        ...(useEdgeChannel ? { channel: "msedge" } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/auth`,
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      APP_BASE_URL: baseURL,
      CATALOG_EXPOSE_RESET_CODE: "true",
      CATALOG_DISABLE_RATE_LIMITS: "true",
      LOCAL_FUNCTIONS_PORT: "8890",
      VITE_PORT: "4173",
    },
  },
});
