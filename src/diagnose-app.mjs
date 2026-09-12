import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectAppBundle } from "./app-bundle.mjs";
import { diagnosticLocations } from "./restart-platform.mjs";

const maxLogFiles = 500;
const maxLogBytes = 2 * 1024 * 1024;
const maxEntries = 12;

export function diagnoseApp({app, home = os.homedir(), inspect = inspectAppBundle, platform = process.platform}) {
  const resolvedHome = path.resolve(home);
  const locations = diagnosticLocations(resolvedHome, platform);
  return {
    state: "diagnostic-report",
    generatedAt: new Date().toISOString(),
    app: inspect(app, {platform}),
    desktopLog: desktopLogEvidence(locations.desktopLogs, resolvedHome),
    rendererErrors: rendererErrorEvidence(locations.rendererScope, resolvedHome)
  };
}

function desktopLogEvidence(root, home) {
  const file = newestLog(root);
  if (file == null) return {state: "not-found", root: displayPath(root, home)};
  const lines = readTail(file, maxLogBytes).split(/\r?\n/);
  const startup = lines.filter(line => /\bLaunching app\b|\[sparkle\].*(?:update|policy)|error boundary/i.test(line));
  const errors = lines.filter(line => /\b(?:error|fatal|exception|unhandled|snag)\b/i.test(line));
  return {
    state: "found",
    file: displayPath(file, home),
    modifiedAt: fs.statSync(file).mtime.toISOString(),
    startup: sanitizeLines(startup.slice(-maxEntries), home),
    errors: sanitizeLines(errors.slice(-maxEntries), home)
  };
}

function rendererErrorEvidence(file, home) {
  if (!regularFile(file)) return {state: "not-found", file: displayPath(file, home)};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return {state: "unreadable", file: displayPath(file, home), error: truncate(String(error.message), 500)};
  }
  const breadcrumbs = Array.isArray(parsed?.scope?.breadcrumbs) ? parsed.scope.breadcrumbs : [];
  const errors = breadcrumbs.filter(entry => entry?.level === "error" || entry?.category === "sentry.event");
  return {
    state: "found",
    file: displayPath(file, home),
    errors: errors.slice(-maxEntries).map(entry => ({
      timestamp: sentryTimestamp(entry.timestamp),
      category: stringOrNull(entry.category),
      message: sanitize(stringOrNull(entry.message), home, 8_000),
      stack: sanitize(argumentStack(entry.data?.arguments), home, 16_000)
    }))
  };
}

function newestLog(root) {
  if (!directory(root)) return null;
  const files = [];
  const pending = [root];
  while (pending.length > 0 && files.length < maxLogFiles) {
    const directoryPath = pending.pop();
    for (const entry of fs.readdirSync(directoryPath, {withFileTypes: true})) {
      const child = path.join(directoryPath, entry.name);
      if (entry.isDirectory() && !entry.isSymbolicLink()) pending.push(child);
      if (entry.isFile() && /^codex-desktop-.*\.log$/.test(entry.name)) files.push(child);
    }
  }
  return files.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
}

function readTail(file, bytes) {
  const size = fs.statSync(file).size;
  const length = Math.min(size, bytes);
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.alloc(length);
  try {
    fs.readSync(descriptor, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(descriptor);
  }
  const text = buffer.toString("utf8");
  return size > length ? text.slice(text.indexOf("\n") + 1) : text;
}

function argumentStack(argumentsValue) {
  if (!Array.isArray(argumentsValue)) return null;
  for (const value of argumentsValue) {
    if (value != null && typeof value === "object" && typeof value.stack === "string") return value.stack;
  }
  return null;
}

function sanitizeLines(lines, home) {
  return lines.map(line => sanitize(line, home, 8_000));
}

function sanitize(value, home, limit) {
  if (value == null) return null;
  return truncate(value.split(home).join("~"), limit);
}

function truncate(value, limit) {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function sentryTimestamp(value) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1_000).toISOString() : null;
}

function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}

function displayPath(value, home) {
  return value === home ? "~" : value.startsWith(`${home}${path.sep}`) ? `~${value.slice(home.length)}` : value;
}

function regularFile(value) {
  return fs.existsSync(value) && fs.statSync(value).isFile();
}

function directory(value) {
  return fs.existsSync(value) && fs.statSync(value).isDirectory();
}
