import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * End-to-end tests against the real stack: FastAPI (with migrations) + Next standalone build.
 * Requires `npm run build` and E2E_DATABASE_URL pointing to a dedicated, disposable database.
 * PYTHON can point to the backend virtualenv interpreter (default: python3).
 */
const FRONTEND_PORT = 3100;
const BACKEND_PORT = 8100;
export const BASE_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
export const MAIL_DIR = path.resolve(here, ".mail-outbox");
const python = process.env.PYTHON ?? "python3";

if (!process.env.E2E_DATABASE_URL)
  throw new Error("Imposta E2E_DATABASE_URL (database dedicato agli e2e).");

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "off", locale: "it-IT" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /(mobile|companies|links|organize|import)\.spec\.ts/,
    },
    // v0.2 scenario: reduced motion, as requested for deterministic runs.
    {
      name: "reduced-motion",
      use: { ...devices["Desktop Chrome"], contextOptions: { reducedMotion: "reduce" } },
      testMatch: /(companies|links|organize|import)\.spec\.ts/,
    },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `${python} -m app.migrate && ${python} -m uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: path.resolve(here, "../backend"),
      url: `http://127.0.0.1:${BACKEND_PORT}/health`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: process.env.E2E_DATABASE_URL,
        APP_ENV: "test",
        MAIL_TRANSPORT: "file",
        MAIL_FILE_DIR: MAIL_DIR,
        PUBLIC_BASE_URL: BASE_URL,
        SHORT_LINK_BASE_URL: BASE_URL,
        SUPPORT_EMAIL: "supporto@example.com",
        STORAGE_LOCAL_PATH: path.resolve(here, ".e2e-uploads"),
        GEOIP_DB_PATH: path.resolve(here, ".e2e-uploads/missing.mmdb"),
      },
    },
    {
      // 0.3: the worker renders the ZIP of bulk imports (e2e/worker.mjs wraps it).
      command: "node e2e/worker.mjs",
      url: "http://127.0.0.1:8200",
      reuseExistingServer: false,
      env: {
        PYTHON: python,
        WORKER_CWD: path.resolve(here, "../backend"),
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
        APP_ENV: "test",
        STORAGE_LOCAL_PATH: path.resolve(here, ".e2e-uploads"),
        WORKER_PORT: "8200",
        PATH: process.env.PATH ?? "",
      },
    },
    {
      command: "node scripts/start-standalone.mjs",
      url: `${BASE_URL}/login`,
      reuseExistingServer: false,
      env: {
        PORT: String(FRONTEND_PORT),
        HOSTNAME: "127.0.0.1",
        API_INTERNAL_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
    },
  ],
});
