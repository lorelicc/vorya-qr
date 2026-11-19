// Starts the backend worker for e2e runs (it renders the ZIP of bulk imports) and exposes a tiny
// readiness endpoint so Playwright's webServer can wait for it.
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const child = spawn(process.env.PYTHON ?? "python3", ["-m", "app.worker"], {
  cwd: process.env.WORKER_CWD,
  stdio: "inherit",
  env: process.env,
});
const stop = () => child.kill("SIGTERM");
process.on("SIGTERM", () => (stop(), process.exit(0)));
process.on("SIGINT", () => (stop(), process.exit(0)));
process.on("exit", stop);
createServer((_, res) => res.end("ok")).listen(
  Number(process.env.WORKER_PORT ?? 8200),
  "127.0.0.1",
);
