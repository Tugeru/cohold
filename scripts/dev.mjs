#!/usr/bin/env node
// Start `next dev` on port 3001, falling back to the next free port.
// Never kills an existing process holding the port. Extra CLI args pass through.
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const START_PORT = 3001;
const NEXT_BIN = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url)
);
const args = process.argv.slice(2);

const isFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port);
  });

let port = START_PORT;
while (!(await isFree(port))) {
  console.log(`Port ${port} is in use, trying ${port + 1}...`);
  port += 1;
}
console.log(`Starting next dev on http://localhost:${port}`);

const child = spawn(
  process.execPath,
  [NEXT_BIN, "dev", "--port", String(port), ...args],
  { stdio: "inherit" }
);
// ponytail: probe-then-spawn has a tiny TOCTOU window (another process can
// grab the port between isFree and next's bind; Next then exits with a clear
// EADDRINUSE). A retry loop could close it, but dev-server startup is
// single-shot and the error message is actionable. Add a spawn retry if this
// ever bites.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});