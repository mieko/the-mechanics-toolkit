#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const record = process.env.RESCUE_RESULT;
if (record == null) throw new Error("RESCUE_RESULT is required");
fs.appendFileSync(record, `${JSON.stringify({
  args,
  cwd: process.cwd(),
  threadId: process.env.CODEX_THREAD_ID ?? null,
  sessionId: process.env.CODEX_SESSION_ID ?? null
})}\n`);

if (!args.includes("--dangerously-bypass-hook-trust")) process.exit(0);
const taskId = args[args.indexOf("--dangerously-bypass-hook-trust") + 3];
const hookOverride = args[args.indexOf("--dangerously-bypass-hook-trust") + 2];
const encodedCommand = hookOverride.match(/command=("(?:\\.|[^"\\])*")/)?.[1];
if (encodedCommand == null) throw new Error("fake rescue CLI cannot find Stop hook command");
const codexHome = process.env.RESCUE_TEST_CODEX_HOME;
if (codexHome == null) throw new Error("RESCUE_TEST_CODEX_HOME is required");
const turnId = crypto.randomUUID();
const transcript = path.join(codexHome, "sessions", `rollout-${taskId}.jsonl`);
fs.mkdirSync(path.dirname(transcript), {recursive: true});
fs.appendFileSync(transcript, '{"type":"session_meta"}\n');
const hook = spawnSync("/bin/sh", ["-lc", JSON.parse(encodedCommand)], {
  input: JSON.stringify({
    hook_event_name: "Stop",
    session_id: taskId,
    turn_id: turnId,
    transcript_path: transcript
  }),
  encoding: "utf8",
  env: process.env
});
if (hook.error != null) throw hook.error;
if (hook.status !== 0) {
  process.stderr.write(hook.stderr);
  process.exit(hook.status ?? 1);
}
fs.appendFileSync(transcript, `${JSON.stringify({
  type: "event_msg",
  payload: {type: "task_complete", turn_id: turnId, last_agent_message: "done"}
})}\n`);
if (process.env.RESCUE_REPAIR_COUNT != null) {
  const repairCount = process.env.RESCUE_REPAIR_COUNT;
  const count = fs.existsSync(repairCount) ? Number(fs.readFileSync(repairCount, "utf8")) : 0;
  fs.writeFileSync(repairCount, String(count + 1));
}
setInterval(() => {}, 1_000);
