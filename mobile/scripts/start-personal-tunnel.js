const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const expoBin = path.join(projectRoot, "node_modules", ".bin", "expo");
const preferredNgrokBin = "/opt/homebrew/bin/ngrok";
const ngrokBin = process.env.NGROK_BIN || (fs.existsSync(preferredNgrokBin) ? preferredNgrokBin : "ngrok");
const port = process.env.EXPO_DEV_SERVER_PORT || "8081";
const token = process.env.NGROK_AUTHTOKEN?.trim();
const startupTimeoutMs = 15000;

function isSuspiciousToken(value) {
  return (
    !value ||
    /\s/.test(value) ||
    value.includes("export NGROK_AUTHTOKEN") ||
    value.includes("npm run") ||
    value.includes("your_token_here")
  );
}

if (token && isSuspiciousToken(token)) {
  console.error("NGROK_AUTHTOKEN does not look valid.");
  console.error("Set it to the raw token only, with no extra shell text.");
  console.error("Correct usage:");
  console.error("  export NGROK_AUTHTOKEN='your_real_ngrok_token'");
  console.error("  npm run start:hotspot -- --clear");
  process.exit(1);
}

let expoProcess;
let ngrokProcess;
let tunnelUrl;
let shuttingDown = false;
let latestNgrokError = null;
let stderrBuffer = "";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTunnelUrl() {
  const start = Date.now();

  while (Date.now() - start < startupTimeoutMs) {
    if (tunnelUrl) {
      return tunnelUrl;
    }

    if (ngrokProcess?.exitCode != null) {
      throw new Error(latestNgrokError || `ngrok exited with code ${ngrokProcess.exitCode}`);
    }

    await delay(250);
  }

  throw new Error(latestNgrokError || "Timed out waiting for ngrok tunnel URL");
}

function flushStderrBuffer() {
  const remaining = stderrBuffer.trim();
  if (remaining) {
    latestNgrokError = remaining;
    stderrBuffer = "";
  }
}

function parseNgrokLine(line) {
  let event;

  try {
    event = JSON.parse(line);
  } catch {
    return;
  }

  if (event.url && String(event.url).startsWith("https://")) {
    tunnelUrl = event.url;
  }

  if (event.err) {
    latestNgrokError = event.err;
  }
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  if (expoProcess && !expoProcess.killed) {
    expoProcess.kill("SIGINT");
  }

  if (ngrokProcess && !ngrokProcess.killed) {
    ngrokProcess.kill("SIGINT");
  }

  process.exit(exitCode);
}

async function startNgrok() {
  console.log(`Opening personal ngrok tunnel to localhost:${port} with ${ngrokBin}...`);

  ngrokProcess = spawn(
    ngrokBin,
    [
      "http",
      port,
      "--log",
      "stdout",
      "--log-format",
      "json",
      ...(token ? ["--authtoken", token] : []),
    ],
    {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    }
  );

  ngrokProcess.stdout.setEncoding("utf8");
  ngrokProcess.stderr.setEncoding("utf8");

  let stdoutBuffer = "";
  ngrokProcess.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      parseNgrokLine(line.trim());
    }
  });

  ngrokProcess.stderr.on("data", (chunk) => {
    stderrBuffer += chunk;
    const lines = stderrBuffer.split("\n");
    stderrBuffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        latestNgrokError = line.trim();
      }
    }
  });

  ngrokProcess.on("exit", (code) => {
    flushStderrBuffer();
    if (!shuttingDown && !tunnelUrl && code !== 0) {
      latestNgrokError ||= `ngrok exited with code ${code}`;
    }
  });

  return waitForTunnelUrl();
}

async function main() {
  tunnelUrl = await startNgrok();

  console.log(`Tunnel URL: ${tunnelUrl}`);
  console.log("Starting Expo with EXPO_PACKAGER_PROXY_URL set to the tunnel...");

  const extraArgs = process.argv.slice(2);
  expoProcess = spawn(expoBin, ["start", "--lan", ...extraArgs], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PACKAGER_PROXY_URL: tunnelUrl,
    },
  });

  expoProcess.on("exit", (code, signal) => {
    if (signal) {
      shutdown(0);
      return;
    }
    shutdown(code || 0);
  });
}

process.on("SIGINT", () => {
  shutdown(0);
});

process.on("SIGTERM", () => {
  shutdown(0);
});

main().catch(async (error) => {
  console.error("Failed to start personal tunnel:", error.message);
  if (String(error.message).includes("ERR_NGROK_108")) {
    console.error("Another ngrok session is already active on this account.");
    console.error("Stop the existing launcher or ngrok process before starting a new one.");
  }
  await shutdown(1);
});
