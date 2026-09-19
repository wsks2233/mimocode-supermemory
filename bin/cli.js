#!/usr/bin/env node
/**
 * mimocode-supermemory installer / auth CLI
 * Browser login aligned with official opencode-supermemory.
 *
 *   npx mimocode-supermemory install|login|logout|status|uninstall
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { arch, hostname, homedir, platform } from "node:os";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";

const PKG_NAME = "mimocode-supermemory";
const CLIENT_NAME = "mimocode";
const CLI_VERSION = "0.2.0";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const AUTH_BASE_URL =
  process.env.SUPERMEMORY_AUTH_URL || "https://console.supermemory.ai/auth/connect";
const AUTH_TIMEOUT = Number(process.env.SUPERMEMORY_AUTH_TIMEOUT) || 5 * 60 * 1000;

function paths() {
  const home = process.env.USERPROFILE || process.env.HOME || homedir();
  return {
    home,
    configDir: join(home, ".config", "mimocode"),
    configFile: join(home, ".config", "mimocode", "mimocode.jsonc"),
    smConfigFile: join(home, ".config", "mimocode", "supermemory.jsonc"),
    credDir: join(home, ".supermemory-mimocode"),
    credFile: join(home, ".supermemory-mimocode", "credentials.json"),
    cacheRoot: join(
      home,
      ".cache",
      "mimocode",
      "packages",
      `${PKG_NAME}@latest`,
      "node_modules",
    ),
  };
}

function readJsonc(text) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
  return stripped.trim() ? JSON.parse(stripped) : {};
}

function loadCredentials() {
  const p = paths();
  if (!existsSync(p.credFile)) return null;
  try {
    return JSON.parse(readFileSync(p.credFile, "utf8"));
  } catch {
    return null;
  }
}

function saveCredentials(apiKey, apiBaseUrl) {
  const p = paths();
  mkdirSync(p.credDir, { recursive: true });
  const payload = { apiKey, createdAt: new Date().toISOString() };
  if (apiBaseUrl) payload.apiBaseUrl = apiBaseUrl;
  writeFileSync(p.credFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  // Also write into supermemory.jsonc so headless MiMo processes pick it up.
  let cfg = {};
  if (existsSync(p.smConfigFile)) {
    try {
      cfg = readJsonc(readFileSync(p.smConfigFile, "utf8"));
    } catch {
      cfg = {};
    }
  }
  cfg.apiKey = apiKey;
  if (apiBaseUrl) cfg.baseUrl = apiBaseUrl;
  mkdirSync(p.configDir, { recursive: true });
  writeFileSync(p.smConfigFile, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

function clearCredentials() {
  const p = paths();
  let removed = false;
  if (existsSync(p.credFile)) {
    rmSync(p.credFile);
    removed = true;
  }
  if (existsSync(p.smConfigFile)) {
    try {
      const cfg = readJsonc(readFileSync(p.smConfigFile, "utf8"));
      if (cfg.apiKey) {
        delete cfg.apiKey;
        writeFileSync(p.smConfigFile, JSON.stringify(cfg, null, 2) + "\n", "utf8");
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

function resolveApiKey() {
  if (process.env.SUPERMEMORY_API_KEY) {
    return { key: process.env.SUPERMEMORY_API_KEY, source: "SUPERMEMORY_API_KEY env" };
  }
  const p = paths();
  if (existsSync(p.smConfigFile)) {
    try {
      const cfg = readJsonc(readFileSync(p.smConfigFile, "utf8"));
      if (cfg.apiKey) return { key: cfg.apiKey, source: p.smConfigFile };
    } catch {
      /* ignore */
    }
  }
  const creds = loadCredentials();
  if (creds?.apiKey) return { key: creds.apiKey, source: p.credFile };
  return { key: "", source: "not configured" };
}

function resolveApiBase() {
  return (
    process.env.SUPERMEMORY_API_URL ||
    process.env.SUPERMEMORY_BASE_URL ||
    (() => {
      const p = paths();
      if (existsSync(p.smConfigFile)) {
        try {
          return readJsonc(readFileSync(p.smConfigFile, "utf8")).baseUrl;
        } catch {
          /* ignore */
        }
      }
      return loadCredentials()?.apiBaseUrl;
    })() ||
    "https://api.supermemory.ai"
  );
}

function maskKey(key) {
  if (!key) return "not set";
  if (key.length <= 12) return `${key.slice(0, 4)}...`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function openUrl(url) {
  const href = String(url);
  if (!/^https?:\/\//i.test(href)) throw new Error("Refusing to open non-http URL");
  if (process.platform === "win32") {
    try {
      execFile("rundll32.exe", ["url.dll,FileProtocolHandler", href], { windowsHide: true });
      return;
    } catch {
      execFile("cmd.exe", ["/c", "start", '""', href], { windowsHide: true });
      return;
    }
  }
  if (process.platform === "darwin") {
    execFile("open", [href]);
    return;
  }
  execFile("xdg-open", [href]);
}

function ensurePluginConfig() {
  const p = paths();
  mkdirSync(p.configDir, { recursive: true });
  let cfg = {};
  if (existsSync(p.configFile)) {
    try {
      cfg = readJsonc(readFileSync(p.configFile, "utf8"));
    } catch {
      cfg = {};
    }
  }
  if (!cfg.$schema) cfg.$schema = "https://mimo.xiaomi.com/mimocode/config.json";
  const list = Array.isArray(cfg.plugin) ? [...cfg.plugin] : [];
  const names = list.map((item) => (Array.isArray(item) ? item[0] : item));
  if (!names.includes(PKG_NAME)) list.push(PKG_NAME);
  cfg.plugin = list;
  writeFileSync(p.configFile, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  return p.configFile;
}

function ensureSmConfigSample() {
  const p = paths();
  mkdirSync(p.configDir, { recursive: true });
  if (!existsSync(p.smConfigFile)) {
    writeFileSync(
      p.smConfigFile,
      `${JSON.stringify(
        {
          apiKey: "",
          baseUrl: "",
          autoInject: true,
          maxMemories: 5,
          maxProjectMemories: 10,
          maxProfileItems: 5,
          similarityThreshold: 0.6,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  return p.smConfigFile;
}

function installFiles() {
  const p = paths();
  mkdirSync(p.cacheRoot, { recursive: true });
  mkdirSync(join(p.cacheRoot, "dist"), { recursive: true });
  mkdirSync(join(p.cacheRoot, PKG_NAME, "dist"), { recursive: true });
  copyFileSync(join(packageRoot, "package.json"), join(p.cacheRoot, "package.json"));
  copyFileSync(join(packageRoot, "dist", "index.js"), join(p.cacheRoot, "dist", "index.js"));
  copyFileSync(
    join(packageRoot, "package.json"),
    join(p.cacheRoot, PKG_NAME, "package.json"),
  );
  copyFileSync(
    join(packageRoot, "dist", "index.js"),
    join(p.cacheRoot, PKG_NAME, "dist", "index.js"),
  );
  return p.cacheRoot;
}

function startAuthFlow(timeoutMs = AUTH_TIMEOUT) {
  return new Promise((resolve) => {
    let resolved = false;
    const stateToken = randomBytes(16).toString("hex");
    const server = createServer((req, res) => {
      if (resolved) return;
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const callbackState = url.searchParams.get("state");
      if (callbackState !== stateToken) {
        res.writeHead(403, { "Content-Type": "text/html" });
        res.end("<h1>Connection Failed</h1><p>Invalid auth state.</p>");
        resolved = true;
        clearTimeout(timer);
        server.close();
        resolve({ success: false, error: "Invalid auth state" });
        return;
      }
      const apiKey =
        url.searchParams.get("apikey") || url.searchParams.get("api_key") || "";
      const apiBaseUrl =
        url.searchParams.get("api_url") ||
        url.searchParams.get("api_base_url") ||
        undefined;
      if (apiKey.startsWith("sm_")) {
        saveCredentials(apiKey, apiBaseUrl);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Connected!</h1><p>You can close this window and return to your terminal.</p>",
        );
        resolved = true;
        clearTimeout(timer);
        server.close();
        resolve({ success: true, apiKey, apiBaseUrl });
        return;
      }
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>Connection Failed</h1><p>No API key received.</p>");
      resolved = true;
      clearTimeout(timer);
      server.close();
      resolve({ success: false, error: "No API key received" });
    });
    server.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({ success: false, error: err.message });
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      const callbackUrl = `http://127.0.0.1:${port}/callback?state=${stateToken}`;
      const params = new URLSearchParams({
        callback: callbackUrl,
        client: CLIENT_NAME,
        hostname: `${CLIENT_NAME} - ${hostname()}`,
        os: `${platform()}-${arch()}`,
        cwd: process.cwd(),
        cli_version: CLI_VERSION,
      });
      const authUrl = `${AUTH_BASE_URL}?${params.toString()}`;
      console.log("Opening browser for Supermemory authentication...");
      console.log("If it doesn't open, visit:");
      console.log(authUrl);
      try {
        openUrl(authUrl);
      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          server.close();
          resolve({ success: false, error: `Failed to open browser: ${error.message}` });
          return;
        }
      }
      console.log("Waiting for callback (timeout 5 minutes)...");
    });
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        resolve({ success: false, error: "Authentication timed out" });
      }
    }, timeoutMs);
  });
}

function cmdInstall() {
  const cache = installFiles();
  const cfg = ensurePluginConfig();
  const sm = ensureSmConfigSample();
  console.log("mimocode-supermemory installed (MiMoCode plugin[] channel)");
  console.log(`  package : ${cache}`);
  console.log(`  config  : ${cfg}  → plugin: ["${PKG_NAME}"]`);
  console.log(`  memory  : ${sm}`);
  console.log("");
  console.log("Next:");
  console.log("  1. mimocode-supermemory login   (browser OAuth)");
  console.log("     or set SUPERMEMORY_API_KEY");
  console.log("  2. Restart MiMoCode / new Desktop session");
  console.log("  3. mimocode-supermemory status");
}

async function cmdLogin() {
  const existing = loadCredentials();
  const envKey = process.env.SUPERMEMORY_API_KEY;
  if (existing?.apiKey && !envKey) {
    console.log("Already authenticated via credentials file.");
    console.log("Use 'logout' first to re-authenticate.");
    return 0;
  }
  const result = await startAuthFlow();
  if (result.success) {
    console.log("");
    console.log("✓ Successfully authenticated with Supermemory!");
    console.log(`  saved: ${paths().credFile}`);
    console.log("Restart MiMoCode to activate.");
    return 0;
  }
  console.error("");
  console.error(`✗ Authentication failed: ${result.error}`);
  return 1;
}

function cmdLogout() {
  const removed = clearCredentials();
  if (removed) {
    console.log("✓ Logged out. Local credentials cleared.");
  } else {
    console.log("No credentials file found.");
  }
  if (process.env.SUPERMEMORY_API_KEY) {
    console.log("SUPERMEMORY_API_KEY is still set in this shell/environment.");
  }
  return 0;
}

async function cmdStatus() {
  const p = paths();
  const pkg = join(p.cacheRoot, "package.json");
  const entry = join(p.cacheRoot, "dist", "index.js");
  let pluginListed = false;
  if (existsSync(p.configFile)) {
    try {
      const cfg = readJsonc(readFileSync(p.configFile, "utf8"));
      pluginListed = (cfg.plugin || []).some(
        (x) => (Array.isArray(x) ? x[0] : x) === PKG_NAME,
      );
    } catch {
      pluginListed = false;
    }
  }
  const { key, source } = resolveApiKey();
  const apiUrl = resolveApiBase();
  const ready = existsSync(pkg) && existsSync(entry) && pluginListed && Boolean(key);
  console.log("mimocode-supermemory status");
  console.log(`  package.json : ${existsSync(pkg) ? "OK" : "MISSING"}  ${pkg}`);
  console.log(`  dist/index.js: ${existsSync(entry) ? "OK" : "MISSING"}  ${entry}`);
  console.log(`  plugin[]     : ${pluginListed ? "OK" : "MISSING"}  ${p.configFile}`);
  console.log(`  API key      : ${maskKey(key)} (${source})`);
  console.log(`  API URL      : ${apiUrl}`);
  if (key) {
    try {
      const res = await fetch(`${apiUrl}/v3/session`, {
        headers: {
          Authorization: `Bearer ${key}`,
          "x-sm-source": "mimocode",
        },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const email = data?.user?.email || data?.email;
        console.log(`  connected    : yes${email ? ` (${email})` : ""}`);
      } else {
        console.log(`  connected    : no (HTTP ${res.status})`);
      }
    } catch (e) {
      console.log(`  connected    : no (${e.message})`);
    }
  } else {
    console.log("  connected    : no");
  }
  console.log(`  ready        : ${ready ? "YES" : "NO"}`);
  process.exitCode = ready ? 0 : 1;
  return 0;
}

function cmdUninstall() {
  const p = paths();
  if (existsSync(p.configFile)) {
    try {
      const cfg = readJsonc(readFileSync(p.configFile, "utf8"));
      if (Array.isArray(cfg.plugin)) {
        cfg.plugin = cfg.plugin.filter(
          (x) => (Array.isArray(x) ? x[0] : x) !== PKG_NAME,
        );
        writeFileSync(p.configFile, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
      }
    } catch {
      /* ignore */
    }
  }
  const cache = join(p.home, ".cache", "mimocode", "packages", `${PKG_NAME}@latest`);
  if (existsSync(cache)) rmSync(cache, { recursive: true, force: true });
  console.log(`uninstalled: removed plugin[] entry and ${cache}`);
  console.log(`kept credentials: ${p.credFile} (use logout to clear)`);
}

const cmd = process.argv[2] || "install";
if (cmd === "install") cmdInstall();
else if (cmd === "login") {
  cmdLogin().then((code) => process.exit(code));
} else if (cmd === "logout") process.exit(cmdLogout());
else if (cmd === "status") {
  cmdStatus().then(() => process.exit(process.exitCode || 0));
} else if (cmd === "uninstall") cmdUninstall();
else {
  console.log(`Usage: mimocode-supermemory <install|login|logout|status|uninstall>

  install   Place plugin into MiMoCode cache + write plugin[] config
  login     Browser OAuth via console.supermemory.ai (official-compatible)
  logout    Clear local credentials
  status    Package/config/key/connection readiness
  uninstall Remove plugin[] entry and cache package

Browser login uses the same Supermemory connect endpoint as opencode-supermemory.
`);
  process.exitCode = cmd === "help" || cmd === "--help" || cmd === "-h" ? 0 : 1;
}
