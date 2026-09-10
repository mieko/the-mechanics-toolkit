#!/usr/bin/env node
import {
  recordRescueStopFailure,
  recordRescueStopReceipt
} from "../src/safe-start.mjs";

const [receiptFile, taskId, codexHome] = process.argv.slice(2);
if (receiptFile == null || taskId == null || codexHome == null) {
  fail("usage: rescue-turn-stop.mjs RECEIPT_FILE TASK_ID CODEX_HOME");
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
try {
  recordRescueStopReceipt(input, {receiptFile, taskId, codexHome});
} catch (error) {
  recordRescueStopFailure(receiptFile, error);
  fail(error.message);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
