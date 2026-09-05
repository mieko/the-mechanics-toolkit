#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: task-supervisor.test.mjs EXTRACTED_ASAR_ROOT");

const assets = path.join(root, "webview/assets");
const matches = fs.readdirSync(assets).filter(name => /^app-initial-.*\.js$/.test(name));
assert.equal(matches.length, 1, "unique app-initial asset");
const source = fs.readFileSync(path.join(assets, matches[0]), "utf8");
const build = source.includes('const MTKtaskSupervisorConfigName7942="task-supervision.json"') ? "7942" : "7746";
const rootName = build === "7942" ? "Oks" : "qOs";
const helperStart = source.indexOf(`const MTKtaskSupervisorConfigName${build}="task-supervision.json"`);
const helperEnd = source.indexOf(
  `function ${rootName}(){MTKuseAttentionBootstrap${build}();MTKusePaletteBootstrap();MTKuseTaskSupervisor${build}();`,
  helperStart
);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "task supervisor helper seam");
const helper = source.slice(helperStart, helperEnd).replaceAll(build, "");
const api = Function(`${helper};return {
  parse:MTKparseTaskSupervisorConfig,
  load:MTKloadTaskSupervisorConfig,
  resolve:MTKresolveTaskSupervisorRules,
  start:MTKstartTaskSupervisor
}`)();

const parsed = api.parse({tasks: [
  {titlePattern: "^tinrelay-radio-room(?:\\b|$)", mode: "keep_alive"},
  {taskId: "11111111-1111-4111-8111-111111111111", mode: "on_start", prompt: "wake"}
]});
assert.ok(parsed);
assert.equal(parsed[0].prompt, "continue");
assert.equal(parsed[0].idleMs, 5000);
assert.equal(parsed[0].titlePattern.test("tinrelay-radio-room — local"), true);
assert.equal(parsed[1].prompt, "wake");
assert.equal(api.parse({tasks: [{titlePattern: "[", mode: "keep_alive"}]}), null);
assert.equal(api.parse({tasks: [{taskId: "not-a-task-id", mode: "keep_alive"}]}), null);
assert.equal(api.parse({tasks: [{titlePattern: "room", taskId: "11111111-1111-4111-8111-111111111111", mode: "keep_alive"}]}), null);
assert.equal(api.parse({tasks: [{titlePattern: "room", mode: "on_start", idleSeconds: 5}]}), null);
assert.equal(api.parse({tasks: [{titlePattern: "room", mode: "keep_alive", idleSeconds: 4}]}), null);
assert.equal(api.parse({tasks: [{titlePattern: "room", mode: "keep_alive", extra: true}]}), null);

const exactThread = thread("11111111-1111-4111-8111-111111111111", "tinrelay-radio-room", "idle");
const titleThread = thread("22222222-2222-4222-8222-222222222222", "tinrelay-radio-room — local", "idle");
const resolved = api.resolve(parsed, [exactThread, titleThread]);
assert.equal(resolved.length, 2);
assert.equal(resolved.find(entry => entry.thread === exactThread).rule.taskId, exactThread.id,
  "exact task ID wins even when an earlier title regex also matches");
assert.equal(resolved.find(entry => entry.thread === titleThread).rule.titlePatternSource,
  "^tinrelay-radio-room(?:\\b|$)");
const originalWarn = console.warn;
let ambiguous;
try {
  console.warn = () => {};
  ambiguous = api.resolve(parsed, [titleThread, {...titleThread, id: "33333333-3333-4333-8333-333333333333"}]);
} finally {
  console.warn = originalWarn;
}
assert.deepEqual(ambiguous, [], "one title regex matching multiple tasks fails closed");

const configText = JSON.stringify({tasks: [{titlePattern: "^room$", mode: "keep_alive"}]});
const configFiles = new Map([
  ["/example/codex-home", {metadata: {isDirectory: true, isSymlink: false}}],
  ["/example/codex-home/task-supervision.json", {
    metadata: {isFile: true, isSymlink: false},
    contents: configText
  }]
]);
const configClient = {
  async sendRequest(method, params) {
    if (method === "config/read") return {layers: [
      {name: {type: "user", file: "/example/codex-home/config.toml"}},
      {name: {type: "user", file: "/example/codex-home/config.toml", profile: "work"}}
    ]};
    const entry = configFiles.get(params.path);
    if (!entry) {
      const error = new Error(`No such file or directory: ${params.path}`);
      error.code = "ENOENT";
      throw error;
    }
    if (method === "fs/getMetadata") return entry.metadata;
    if (method === "fs/readFile") return {dataBase64: Buffer.from(entry.contents).toString("base64")};
    throw new Error(`unexpected request ${method}`);
  }
};
assert.equal((await api.load(configClient))[0].titlePatternSource, "^room$",
  "the user config layer locates one CODEX_HOME policy file");
assert.equal(await api.load({...configClient, async sendRequest(method, params) {
  if (method === "config/read") return {layers: []};
  return configClient.sendRequest(method, params);
}}), null, "missing user config layer disables supervision");

class FakeClock {
  now = 0;
  nextId = 1;
  timers = new Map();

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.timers.set(id, {at: this.now + delay, callback});
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  async tick(milliseconds) {
    const end = this.now + milliseconds;
    while (true) {
      const pending = [...this.timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at);
      if (pending.length === 0) break;
      const [id, timer] = pending[0];
      this.timers.delete(id);
      this.now = timer.at;
      timer.callback();
      await settle();
    }
    this.now = end;
    await settle();
  }
}

class FakeClient {
  constructor(threads) {
    this.threads = new Map(threads.map(value => [value.id, structuredClone(value)]));
  }

  requests = [];
  turnStarts = [];
  callbacks = new Set();
  automatic = 0;

  async sendRequest(method, params) {
    this.requests.push([method, structuredClone(params)]);
    if (method === "thread/list") {
      return {data: [...this.threads.values()].map(value => structuredClone(value)), nextCursor: null};
    }
    if (method === "thread/read") return {thread: structuredClone(this.threads.get(params.threadId))};
    if (method === "thread/resume") {
      const value = this.threads.get(params.threadId);
      value.status = {type: "idle"};
      value.canAcceptDirectInput = true;
      return {thread: structuredClone(value)};
    }
    if (method === "turn/start") {
      const value = this.threads.get(params.threadId);
      assert.equal(value.status.type, "idle", "fake server accepts automated input only while idle");
      const id = `automatic-${++this.automatic}`;
      value.status = {type: "active", activeFlags: []};
      this.turnStarts.push(structuredClone(params));
      this.emit("turn/started", {threadId: params.threadId, turn: {id, status: "inProgress"}});
      return {turn: {id, status: "inProgress"}};
    }
    throw new Error(`unexpected request ${method}`);
  }

  addNotificationCallback(_methods, callback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  emit(method, params) {
    for (const callback of this.callbacks) callback({method, params});
  }

  status(threadId, type) {
    const value = this.threads.get(threadId);
    value.status = {type, ...(type === "active" ? {activeFlags: []} : {})};
    this.emit("thread/status/changed", {threadId, status: value.status});
  }

  startExternal(threadId, turnId) {
    const value = this.threads.get(threadId);
    value.status = {type: "active", activeFlags: []};
    this.emit("turn/started", {threadId, turn: {id: turnId, status: "inProgress"}});
  }

  complete(threadId, turnId) {
    const value = this.threads.get(threadId);
    value.status = {type: "idle"};
    this.emit("turn/completed", {threadId, turn: {id: turnId, status: "completed", items: []}});
  }
}

const quietConsole = {info() {}, warn() {}};

const clock = new FakeClock();
const client = new FakeClient([
  thread("44444444-4444-4444-8444-444444444444", "tinrelay-radio-room", "idle")
]);
const runtime = {setTimeout: clock.setTimeout.bind(clock), clearTimeout: clock.clearTimeout.bind(clock),
  performance: {now: () => clock.now},
  crypto: {randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}, console: quietConsole};
const supervisor = await api.start(client, api.parse({tasks: [
  {titlePattern: "^tinrelay-radio-room$", mode: "keep_alive", prompt: "continue", idleSeconds: 5}
]}), runtime);
await clock.tick(4999);
assert.equal(client.turnStarts.length, 0, "keep-alive leaves the grace period quiet");
await clock.tick(1);
assert.equal(client.turnStarts.length, 1, "keep-alive wakes one idle task after the grace period");
assert.deepEqual(client.turnStarts[0], {
  threadId: "44444444-4444-4444-8444-444444444444",
  input: [{type: "text", text: "continue", text_elements: []}],
  clientUserMessageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  turnTrigger: "task_supervisor"
});

client.complete("44444444-4444-4444-8444-444444444444", "automatic-1");
await clock.tick(30000);
assert.equal(client.turnStarts.length, 1, "a rapidly completed automatic turn opens the retry fuse");
client.startExternal("44444444-4444-4444-8444-444444444444", "human-1");
client.complete("44444444-4444-4444-8444-444444444444", "human-1");
await clock.tick(5000);
assert.equal(client.turnStarts.length, 2, "real task activity rearms keep-alive once it returns idle");

client.complete("44444444-4444-4444-8444-444444444444", "automatic-2");
client.startExternal("44444444-4444-4444-8444-444444444444", "human-2");
client.complete("44444444-4444-4444-8444-444444444444", "human-2");
client.status("44444444-4444-4444-8444-444444444444", "idle");
client.status("44444444-4444-4444-8444-444444444444", "active");
await clock.tick(5000);
assert.equal(client.turnStarts.length, 2, "activity during the grace period cancels a pending wake");
supervisor.dispose();

const healthyClock = new FakeClock();
const healthyClient = new FakeClient([
  thread("66666666-6666-4666-8666-666666666666", "persistent task", "idle")
]);
const healthySupervisor = await api.start(healthyClient, api.parse({tasks: [
  {titlePattern: "^persistent task$", mode: "keep_alive", idleSeconds: 5}
]}), {...runtime,
  setTimeout: healthyClock.setTimeout.bind(healthyClock),
  clearTimeout: healthyClock.clearTimeout.bind(healthyClock),
  performance: {now: () => healthyClock.now}
});
await healthyClock.tick(5000);
assert.equal(healthyClient.turnStarts.length, 1);
await healthyClock.tick(5000);
healthyClient.complete("66666666-6666-4666-8666-666666666666", "automatic-1");
await healthyClock.tick(5000);
assert.equal(healthyClient.turnStarts.length, 2,
  "a recovery turn that stayed active through one grace period rearms keep-alive");
healthySupervisor.dispose();

const startClock = new FakeClock();
const startClient = new FakeClient([
  thread("55555555-5555-4555-8555-555555555555", "cold task", "notLoaded")
]);
const startSupervisor = await api.start(startClient, api.parse({tasks: [
  {taskId: "55555555-5555-4555-8555-555555555555", mode: "on_start", prompt: "resume once"}
]}), {...runtime, setTimeout: startClock.setTimeout.bind(startClock), clearTimeout: startClock.clearTimeout.bind(startClock)});
await settle();
assert.deepEqual(startClient.requests.filter(([method]) => method === "thread/resume").map(([, params]) => params), [
  {threadId: "55555555-5555-4555-8555-555555555555", excludeTurns: true}
]);
assert.equal(startClient.turnStarts.length, 1, "on-start resumes an unloaded task and prompts it once");
startClient.complete("55555555-5555-4555-8555-555555555555", "automatic-1");
startClient.status("55555555-5555-4555-8555-555555555555", "idle");
await startClock.tick(30000);
assert.equal(startClient.turnStarts.length, 1, "on-start never becomes an idle loop");
startSupervisor.dispose();

assert.ok(source.includes(`navigator.locks.request(MTKtaskSupervisorLock${build}`),
  "one renderer owns supervision through the browser lock");
assert.ok(source.includes('sendRequest("thread/read"') && source.includes('n.status?.type!=="idle"'),
  "the supervisor rechecks authoritative task status immediately before turn/start");
assert.ok(source.includes("automatic recovery completed too quickly; fuse opened"),
  "rapid-completion prompt-storm fuse is visible in diagnostics");

process.stdout.write(`${JSON.stringify({
  state: "green",
  config: "$CODEX_HOME/task-supervision.json",
  modes: ["on_start", "keep_alive"],
  selectorPrecedence: ["taskId", "titlePattern"],
  defaultIdleSeconds: 5,
  duplicateTitleMatch: "fail-closed",
  rapidAutomaticCompletion: "fused-until-human-activity-or-restart",
  rendererOwnership: "Web Lock",
  installedAppMutation: false
}, null, 2)}\n`);

function thread(id, name, status) {
  return {id, name, status: {type: status}, canAcceptDirectInput: status === "notLoaded" ? null : true};
}

async function settle() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}
