import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runProcess(name, dir, command, args, color) {
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? `${command}.cmd` : command;

  const proc = spawn(cmd, args, {
    cwd: path.resolve(__dirname, dir),
    shell: true,
    stdio: "pipe",
    env: process.env,
  });

  proc.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}[${name}]\x1b[0m ${line}`);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${color}[${name}]\x1b[31m ${line}\x1b[0m`);
      }
    }
  });

  proc.on("close", (code) => {
    console.log(`${color}[${name}]\x1b[0m exited with code ${code}`);
  });

  return proc;
}

console.log("\x1b[36m======================================================");
console.log("       Starting Hostelia (Frontend + Backend)         ");
console.log("======================================================\x1b[0m\n");

const backend = runProcess("Backend", "backend", "npm", ["run", "dev"], "\x1b[33m");
const frontend = runProcess("Frontend", "frontend", "npm", ["run", "dev"], "\x1b[34m");

function shutdown() {
  console.log("\nShutting down servers...");
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
