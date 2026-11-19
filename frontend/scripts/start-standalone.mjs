// Runs the standalone server locally (Docker copies these folders in its own build stage).
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const standalone = `${root}.next/standalone`;
if (!existsSync(`${standalone}/server.js`)) {
  console.error("Esegui prima `npm run build`.");
  process.exit(1);
}
cpSync(`${root}.next/static`, `${standalone}/.next/static`, { recursive: true });
cpSync(`${root}public`, `${standalone}/public`, { recursive: true });
const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
