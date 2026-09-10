import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applicationLayout, defaultTerminal, resolveApplication } from "./restart-platform.mjs";

const taskIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rescueKeys = new Set(["taskId", "cwd", "title", "prompt", "terminalApp", "readyTimeoutSeconds"]);

export function rescueConfiguration(environment, applicationArgument, {
  threadLookup = lookupThread,
  rescueFile = {},
  invocationPrompt = null,
  userHome = os.homedir(),
  platform = process.platform
} = {}) {
  validateRescueFile(rescueFile);
  const codexIds = [optionalString(environment.CODEX_THREAD_ID), optionalString(environment.CODEX_SESSION_ID)].filter(Boolean);
  if (new Set(codexIds).size > 1) throw new Error("CODEX_THREAD_ID and CODEX_SESSION_ID disagree");
  const taskId = codexIds[0] ?? optionalString(rescueFile.taskId);
  const thread = taskId == null ? null : threadLookup(taskId, userHome);
  const configuredCwd = optionalString(rescueFile.cwd);
  const cwdValue = usableDirectory(thread?.cwd) ? thread.cwd : configuredCwd;
  const missing = [];
  if (taskId == null) missing.push("taskId (CODEX_THREAD_ID/CODEX_SESSION_ID unavailable; set it in RESCUE-AGENT.json)");
  if (cwdValue == null) missing.push("cwd (thread catalog had no usable directory; set it in RESCUE-AGENT.json)");
  if (missing.length > 0) {
    throw new Error(`rescue context is missing required values:\n${missing.map(name => `  ${name}`).join("\n")}`);
  }
  const cwd = path.resolve(cwdValue);
  if (!directory(cwd)) throw new Error(`rescue cwd is not a directory: ${cwd}`);
  if (!taskIdPattern.test(taskId)) throw new Error(`rescue taskId is not a UUID: ${taskId}`);
  const timeoutSeconds = optionalInteger(rescueFile.readyTimeoutSeconds, 300, 30, 1_800,
    "RESCUE-AGENT.json readyTimeoutSeconds");
  const app = resolveApplication(applicationArgument, platform);
  const {executable, cli} = applicationLayout(app, platform);
  if (!regularFile(executable)) throw new Error(`Codex executable is missing: ${executable}`);
  if (!regularFile(cli)) throw new Error(`Bundled Codex CLI is missing: ${cli}`);
  return {
    app,
    executable,
    cli,
    cwd,
    taskId,
    title: optionalString(thread?.title) ?? optionalString(rescueFile.title),
    prompt: optionalString(invocationPrompt) ?? optionalString(rescueFile.prompt),
    terminalApp: optionalString(rescueFile.terminalApp) ?? defaultTerminal(platform),
    platform,
    timeoutSeconds
  };
}

export function rescuePrompt({reason, diagnosticFile, supervisorLog, appStdioLog, requestedPrompt = null}) {
  for (const [name, value] of Object.entries({reason, diagnosticFile, supervisorLog, appStdioLog})) {
    if (typeof value !== "string" || value.trim() === "") throw new Error(`rescue prompt ${name} is required`);
  }
  const prefix = optionalString(requestedPrompt);
  return `${prefix == null ? "" : `${prefix}\n\n`}` +
    `Codex Desktop failed to reach renderer readiness: ${reason}. ` +
    "You are now running in the Codex CLI escape line; native Codex Desktop task-to-task " +
    "messaging and app tools are not available here. " +
    `The bounded diagnostic report is at ${diagnosticFile}. ` +
    `The supervisor log is at ${supervisorLog}. ` +
    `The failed application's standard output and error are at ${appStdioLog}. ` +
    "Inspect that evidence, diagnose the launch failure, and repair the smallest causal seam.\n";
}

export function loadRescueFile(file) {
  if (typeof file !== "string" || file === "") return {};
  if (!regularFile(file)) return {};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot parse ${file}: ${error.message}`);
  }
  validateRescueFile(parsed);
  return parsed;
}

export function lookupThread(taskId, userHome) {
  if (!taskIdPattern.test(taskId) || typeof userHome !== "string" || userHome === "") return null;
  const candidates = [
    {
      database: path.join(userHome, ".codex/state_5.sqlite"),
      query: "select cwd,coalesce(name,'') as title from threads where id=? limit 1"
    },
    {
      database: path.join(userHome, ".codex/sqlite/codex-dev.db"),
      query: "select cwd,display_title as title from local_thread_catalog where host_id='local' and thread_id=? limit 1"
    }
  ];
  for (const candidate of candidates) {
    if (!regularFile(candidate.database)) continue;
    let database;
    try {
      database = new DatabaseSync(candidate.database, {readOnly: true});
      const row = database.prepare(candidate.query).get(taskId);
      if (row != null && typeof row.cwd === "string" && row.cwd !== "") {
        return {cwd: row.cwd, title: typeof row.title === "string" && row.title !== "" ? row.title : null};
      }
    } catch {
    } finally {
      try { database?.close(); } catch {}
    }
  }
  return null;
}

export function waitForReadiness({child, marker, timeoutMs, intervalMs = 100}) {
  return new Promise(resolve => {
    let settled = false;
    let interval = null;
    let timeout = null;
    const finish = result => {
      if (settled) return;
      settled = true;
      if (interval != null) clearInterval(interval);
      if (timeout != null) clearTimeout(timeout);
      child.off("exit", exited);
      child.off("error", failed);
      resolve(result);
    };
    const exited = (code, signal) => finish({kind: "exited", code, signal});
    const failed = error => finish({kind: "launch-failed", error});
    const check = () => {
      if (regularFile(marker)) finish({kind: "ready"});
    };
    child.once("exit", exited);
    child.once("error", failed);
    interval = setInterval(check, intervalMs);
    timeout = setTimeout(() => finish({kind: "timed-out"}), timeoutMs);
    check();
  });
}

export function launchStatus(state) {
  if (state == null || typeof state !== "object") return {state: "not-found", launched: false};
  const markerExists = typeof state.marker === "string" && regularFile(state.marker);
  return {...state, markerExists, launched: state.phase === "ready" && markerExists};
}

function optionalInteger(value, fallback, minimum, maximum, name) {
  if (value == null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  if (parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  return parsed;
}

function optionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function usableDirectory(value) {
  return typeof value === "string" && value !== "" && directory(value);
}

function validateRescueFile(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("RESCUE-AGENT.json must contain one JSON object");
  }
  const unknown = Object.keys(value).filter(key => !rescueKeys.has(key));
  if (unknown.length > 0) throw new Error(`RESCUE-AGENT.json has unknown keys: ${unknown.join(", ")}`);
  for (const key of ["taskId", "cwd", "title", "prompt", "terminalApp"]) {
    if (value[key] != null && typeof value[key] !== "string") {
      throw new Error(`RESCUE-AGENT.json ${key} must be a string`);
    }
  }
}

function regularFile(value) {
  return fs.existsSync(value) && fs.statSync(value).isFile();
}

function directory(value) {
  return fs.existsSync(value) && fs.statSync(value).isDirectory();
}
