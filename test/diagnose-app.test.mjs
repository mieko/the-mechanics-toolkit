import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diagnoseApp } from "../src/diagnose-app.mjs";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mechanics-toolkit-diagnose-test-"));
try {
  const logRoot = path.join(scratch, "Library/Logs/com.openai.codex/2026/09/09");
  const sentryRoot = path.join(scratch, "Library/Application Support/Codex/sentry");
  fs.mkdirSync(logRoot, {recursive: true});
  fs.mkdirSync(sentryRoot, {recursive: true});
  const older = path.join(logRoot, "codex-desktop-older.log");
  const newest = path.join(logRoot, "codex-desktop-newest.log");
  fs.writeFileSync(older, "2026-09-09T00:00:00Z error old failure\n");
  fs.writeFileSync(newest, [
    "2026-09-09T01:00:00Z info Launching app packaged=true",
    `2026-09-09T01:00:01Z error renderer failed file=${scratch}/private.txt`,
    ""
  ].join("\n"));
  fs.utimesSync(older, new Date(1_000), new Date(1_000));
  fs.utimesSync(newest, new Date(2_000), new Date(2_000));
  fs.writeFileSync(path.join(sentryRoot, "scope_v3.json"), JSON.stringify({scope: {breadcrumbs: [
    {timestamp: 2, category: "electron.net", data: {url: "https://secret.invalid"}},
    {timestamp: 3, category: "console", level: "error", message: "TypeError: broken", data: {
      arguments: [{stack: `TypeError: broken\n at ${scratch}/bundle.js:1:2`}]
    }}
  ]}}));

  const report = diagnoseApp({
    app: "/Applications/ChatGPT.app",
    home: scratch,
    platform: "darwin",
    inspect: app => ({app, version: "test", build: "1"})
  });
  assert.equal(report.state, "diagnostic-report");
  assert.equal(report.app.version, "test");
  assert.match(report.desktopLog.file, /codex-desktop-newest\.log$/);
  assert.deepEqual(report.desktopLog.startup, ["2026-09-09T01:00:00Z info Launching app packaged=true"]);
  assert.match(report.desktopLog.errors[0], /file=~\/private\.txt/);
  assert.equal(report.rendererErrors.errors.length, 1, "unrelated network breadcrumbs are omitted");
  assert.match(report.rendererErrors.errors[0].stack, /at ~\/bundle\.js:1:2/);
  process.stdout.write("diagnostic collection probe passed\n");
} finally {
  fs.rmSync(scratch, {recursive: true, force: true});
}
