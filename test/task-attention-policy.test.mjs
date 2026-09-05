#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: task-attention-policy.test.mjs EXTRACTED_ASAR_ROOT [POLICY_PROJECT_ROOT]");
const projectRoot = path.resolve(process.argv[3] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."));
const assets = path.join(root, "webview/assets");
const names = fs.readdirSync(assets);
const matches = names.filter(name => /^app-initial-.*\.js$/.test(name));
assert.equal(matches.length, 1, "unique app-initial asset");
const source = fs.readFileSync(path.join(assets, matches[0]), "utf8");
const build7345 = source.includes("function MTKuseAttentionBootstrap7345(");
const build7746 = source.includes("function MTKuseAttentionBootstrap7746(");
const build7942 = source.includes("function MTKuseAttentionBootstrap7942(");
const primaryMatches = names.filter(name => /^app-primary-.*\.js$/.test(name));
assert.equal(primaryMatches.length, 1, "unique app-primary asset");
const primarySource = fs.readFileSync(path.join(assets, primaryMatches[0]), "utf8");
const helperStart = source.indexOf('const MTKattentionRelativePath=');
const helperTail = source.slice(helperStart);
const boundary = helperTail.match(build7942
  ? /function Oks\(\)\{MTKuseAttentionBootstrap7942\(\);/
  : build7746
  ? /function qOs\(\)\{MTKuseAttentionBootstrap7746\(\);/
  : build7345
  ? /function g\$c\(e\)\{MTKuseAttentionBootstrap7345\(\);/
  : /function (?:Fjl|zMl|hYl)\(e\)\{MTKuseAttentionBootstrap\(\);/);
assert.ok(helperStart >= 0 && boundary, "attention helper seam");
const rawHelper = helperTail.slice(0, boundary.index);
const helper = build7942 ? rawHelper.replaceAll("7942", "") : build7746 ? rawHelper.replaceAll("7746", "") : rawHelper;
const selectorNames = build7942 ? ["XU", "$P"] : build7746 ? ["aW"] : build7345 ? ["VN", "AH"] : ["Rx", "Lx"];
const api = Function(
  ...selectorNames,
  "Db", "Eb", "Tb", "wb", "Fb", "Pb", "Hg", "Vg", "$g", "Qg", "Rg", "Lg", "Bg", "zg",
  "build7345",
  `${helper};MTKattentionPolicyAtom={test:!0};return build7345?{MTKloadAttentionPolicy:MTKloadAttentionPolicy7345,MTKparseAttentionPolicy:MTKparseAttentionPolicy7345,MTKattentionMatch:MTKattentionMatch7345,MTKattentionIgnored:MTKattentionIgnored7345,MTKattentionIgnoredThread:MTKattentionIgnoredThread7345,MTKinstallAttentionPolicy:MTKinstallAttentionPolicy7345,MTKacceptAttentionReload:MTKacceptAttentionReload7345,MTKattentionPolicyAtom}:{MTKloadAttentionPolicy,MTKparseAttentionPolicy,MTKattentionMatch,MTKattentionIgnored,MTKattentionIgnoredThread,MTKinstallAttentionPolicy,MTKacceptAttentionReload,MTKattentionPolicyAtom}`
)(...selectorNames.map(name => name === "$P" ? key => key == null ? null : key.startsWith("local:")
  ? { kind: "local", threadId: key.slice(6) }
  : key.startsWith("remote:") ? { kind: "remote", taskId: key.slice(7) } : null : Symbol(name)),
  Symbol("Db"), () => client,
  Symbol("Tb"), () => client,
  Symbol("Fb"), () => client,
  Symbol("Hg"), () => client,
  Symbol("$g"), () => client,
  Symbol("Rg"), () => client,
  Symbol("Bg"), () => client,
  build7345);

const owner = "/policy-owner";
const policy = fs.readFileSync(path.join(projectRoot, ".codex/task-attention-policy.json"), "utf8");
const policyObject = JSON.parse(policy);
const files = new Map();
directory(`${owner}/.codex`);
file(`${owner}/.codex/task-attention-policy.json`, policy);
const client = {
  async sendRequest(method, { path: target }) {
    const entry = files.get(target);
    if (!entry) {
      const error = new Error(`No such file or directory: ${target}`);
      error.code = "ENOENT";
      throw error;
    }
    if (method === "fs/getMetadata") return entry.metadata;
    if (method === "fs/readFile") return { dataBase64: Buffer.from(entry.contents).toString("base64") };
    throw new Error(`unexpected request ${method}`);
  }
};

const loaded = await api.MTKloadAttentionPolicy(client, build7345 || build7746 || build7942 ? owner : [owner, owner]);
assert.ok(loaded, "one unique valid owner loads");
assert.equal(loaded.length, policyObject.ignore.length, "every configured ignore rule loads");
const behaviorPolicy = api.MTKparseAttentionPolicy(Buffer.from(JSON.stringify({
  ignore: ["^task-local-ignore$", "^task-remote-ignore$", "^task-radio-ignore$"]
})).toString("base64"));
assert.ok(behaviorPolicy, "bounded behavior policy parses independently of operator configuration");
assert.equal(api.MTKattentionMatch(behaviorPolicy, "quiet-worker", "task-local-ignore"), true);
assert.equal(api.MTKattentionMatch(behaviorPolicy, "research-desk", "task-remote-ignore"), true);
assert.equal(api.MTKattentionMatch(behaviorPolicy, "radio-room", "task-radio-ignore"), true);
assert.equal(api.MTKattentionMatch(behaviorPolicy, "quiet-worker", "other"), false, "same title outside the selected task stays ordinary");
assert.equal(api.MTKattentionMatch(behaviorPolicy, "ordinary", "task-local-other"), false,
  "similar task IDs do not match");
assert.equal(api.MTKattentionMatch(behaviorPolicy, "ordinary", "other"), false);

const currentFlattenedEntries = build7345 || build7746 || helper.includes("r.conversationId!=null");
const entries = new Map([
  ["ignored-local", {
    kind: "local",
    ...(currentFlattenedEntries
      ? { conversationId: "task-local-ignore", catalogTitle: "quiet-worker" }
      : { conversation: { id: "task-local-ignore", title: "quiet-worker" } })
  }],
  ["ignored-remote", {
    kind: "remote",
    task: { id: "task-remote-ignore", title: "research-desk" }
  }],
  ["ordinary-local", {
    kind: "local",
    ...(currentFlattenedEntries
      ? { conversationId: "other", summary: { title: "ordinary" } }
      : { conversation: { id: "other", title: "ordinary" } })
  }],
  ["pending-local", {
    kind: "local",
    ...(currentFlattenedEntries ? { conversationId: null } : { conversation: null }),
    pendingWorktree: { createdAt: 1 }
  }]
]);
const getEntry = (selector, key) => {
  if (build7345 && typeof key === "object") {
    const entry = [...entries.values()].find(entry => entry.conversationId === key.threadId);
    return entry?.catalogTitle ?? entry?.summary?.title ?? null;
  }
  if (build7942) {
    const id = key.replace(/^(?:local:|remote:)/, "");
    if (id === "task-local-ignore") return entries.get("ignored-local");
    if (id === "task-remote-ignore") return entries.get("ignored-remote");
    return entries.get(id) ?? null;
  }
  return entries.get(key) ?? null;
};
const localKey = build7942 ? "local:task-local-ignore" : "ignored-local";
const remoteKey = build7942 ? "remote:task-remote-ignore" : "ignored-remote";
const ordinaryKey = build7942 ? "local:ordinary-local" : "ordinary-local";
const pendingKey = build7942 ? "local:pending-local" : "pending-local";
assert.equal(api.MTKattentionIgnoredThread(getEntry, localKey, behaviorPolicy), true,
  "dock filtering uses genuine local task title and ID metadata");
assert.equal(api.MTKattentionIgnoredThread(getEntry, remoteKey, behaviorPolicy), true,
  "dock filtering uses genuine remote task title and ID metadata");
assert.equal(api.MTKattentionIgnoredThread(getEntry, ordinaryKey, behaviorPolicy), false);
assert.equal(api.MTKattentionIgnoredThread(getEntry, pendingKey, behaviorPolicy), false,
  "pending local entries without a conversation stay ordinary");
if (currentFlattenedEntries) {
  assert.ok(!helper.includes("r.conversation.title"),
    "current dock filtering does not assume the retired nested local-entry shape");
  assert.ok(build7942
    ? source.includes("MTKattentionPolicyAtom=My(Q,null)") && source.includes("function Oks(){MTKuseAttentionBootstrap7942();")
    : build7746
    ? source.includes("MTKattentionPolicyAtom=ky(Q,null)") && source.includes("function qOs(){MTKuseAttentionBootstrap7746();")
    : build7345
    ? source.includes("MTKattentionPolicyAtom=Qg($,null)") && source.includes("function g$c(e){MTKuseAttentionBootstrap7345();")
    : source.includes("Bml(),SW(),H4a(),oTl(),nwl()"),
  "current sidebar bootstrap initializes the module that owns the policy atom before async installation");
}

const policyWrites = [];
const policyScope = {
  get() { return {}; },
  set: (...args) => policyWrites.push(args),
  when() { throw new Error("manager is already ready"); }
};
api.MTKinstallAttentionPolicy(behaviorPolicy, policyScope);
assert.deepEqual(policyWrites, [[api.MTKattentionPolicyAtom, behaviorPolicy]],
  "async policy installation invalidates the shared unread-count selector");
file(`${owner}/.codex/task-attention-policy.json`, "{partial");
assert.equal(await api.MTKacceptAttentionReload(
  policyScope,
  build7345 || build7746 || build7942 ? owner : [owner],
  { initial: false },
  () => true
), false, "invalid external saves are rejected by the consumer acceptance callback");
assert.equal(policyWrites.length, 1, "an invalid save preserves the last-good policy");
assert.equal(api.MTKattentionIgnored("quiet-worker", "task-local-ignore"), true);
file(`${owner}/.codex/task-attention-policy.json`, '{"ignore":["^replacement$"]}');
assert.equal(await api.MTKacceptAttentionReload(
  policyScope,
  build7345 || build7746 || build7942 ? owner : [owner],
  { initial: false },
  () => true
), true, "a complete valid external save is accepted");
assert.equal(policyWrites.length, 2, "accepted policy is published through the shared atom");
assert.equal(api.MTKattentionIgnored("quiet-worker", "task-local-ignore"), false);
assert.equal(api.MTKattentionIgnored("replacement", "other"), true);

assert.equal(await api.MTKloadAttentionPolicy(client, build7345 || build7746 || build7942 ? "/missing" : ["/missing"]), null, "zero owners are vanilla");
directory("/second/.codex");
file("/second/.codex/task-attention-policy.json", policy);
if (!build7345 && !build7746 && !build7942) assert.equal(await api.MTKloadAttentionPolicy(client, [owner, "/second"]), null, "multiple owners fail closed");
assert.equal(api.MTKparseAttentionPolicy(Buffer.from("not json").toString("base64")), null);
assert.equal(api.MTKparseAttentionPolicy(Buffer.from('{"ignore":["["]}').toString("base64")), null);
assert.equal(api.MTKparseAttentionPolicy(Buffer.from('{"ignore":[],"extra":true}').toString("base64")), null);

const rowContracts = build7942 ? [
  "MTKattentionIgnoredForTask=MTKuseTaskAttention7942(ft,n)",
  "let kt=MTKattentionIgnoredForTask?{...Ot,unread:!1,unreadCount:0}:Ot",
  "Nt=MTKattentionIgnoredForTask?[]:Mt==null?[]:[Mt]",
  "let zt=MTKattentionIgnoredForTask?void 0:Rt",
  "hasUnreadTurn:!MTKattentionIgnoredForTask&&!Tt&&$e===!0"
] : build7746 ? [
  "MTKattentionIgnoredForTask=MTKuseTaskAttention7746(dt,n)",
  "let Ot=MTKattentionIgnoredForTask?{...Dt,unread:!1,unreadCount:0}:Dt",
  "Mt=MTKattentionIgnoredForTask?[]:jt==null?[]:[jt]",
  "let Rt=MTKattentionIgnoredForTask?void 0:Lt",
  "hasUnreadTurn:!MTKattentionIgnoredForTask&&!wt&&Qe===!0"
] : build7345 ? [
  "MTKattentionIgnoredForTask=MTKuseTaskAttention7345(dt,n)",
  "let kt=MTKattentionIgnoredForTask?{...Ot,unread:!1,unreadCount:0}:Ot",
  "Nt=MTKattentionIgnoredForTask?[]:Mt==null?[]:[Mt]",
  "let zt=MTKattentionIgnoredForTask?void 0:Rt",
  "hasUnreadTurn:!MTKattentionIgnoredForTask&&!wt&&Qe===!0"
] : [
  "MTKattentionIgnoredForTask=MTKuseTaskAttention(ut,n)",
  "let Ot=MTKattentionIgnoredForTask?{...Dt,unread:!1,unreadCount:0}:Dt",
  "Mt=MTKattentionIgnoredForTask?[]:jt==null?[]:[jt]",
  "let Rt=MTKattentionIgnoredForTask?void 0:Lt",
  "hasUnreadTurn:!MTKattentionIgnoredForTask&&!Ct&&Qe===!0"
];
const rowSource = build7942 || build7746 ? primarySource : source;
for (const contract of rowContracts) assert.ok(rowSource.includes(contract), `task-row contract: ${contract}`);
assert.ok(rowSource.includes(build7942 ? "Ot=je?{type:`loading`}" : "Ae?{type:`loading`}"), "running state remains owned by the stock status calculation");
assert.ok(rowSource.includes(build7345 || build7942 ? "hasSystemError:kt.type===`error`" : "hasSystemError:Ot.type===`error`"),
  "failure state remains visible in the task hover card");

const notificationMarker = "[desktop-notifications] suppressed task-attention-policy turn-complete";
assert.equal(count(source, notificationMarker), 1, "only the native turn-complete owner has policy suppression");
assert.ok(
    source.includes("let a=q3n(e.getConversation(t.conversationId));if(MTKattentionIgnored7345(a,t.conversationId))") ||
    source.includes("let a=BB(e.getConversation(t.conversationId));if(MTKattentionIgnored7746(a,t.conversationId))") ||
    source.includes("let a=RB(e.getConversation(t.conversationId));if(MTKattentionIgnored7942(a,t.conversationId))") ||
    source.includes("let a=sx(e.getConversation(t.conversationId));if(MTKattentionIgnored(a,t.conversationId))") ||
    source.includes("let a=ox(e.getConversation(t.conversationId));if(MTKattentionIgnored(a,t.conversationId))") ||
    source.includes("let a=ax(e.getConversation(t.conversationId));if(MTKattentionIgnored(a,t.conversationId))"),
  "notification policy uses actual source-task title and ID metadata");
assert.equal(count(source, "[desktop-notifications] show question"), 1,
  "input-request notification owner remains stock");
assert.equal(count(source, "[desktop-notifications] show approval"), 1,
  "approval notification owner remains stock");
const ignoredThreadName = build7942 ? "MTKattentionIgnoredThread7942" : build7746 ? "MTKattentionIgnoredThread7746" : build7345 ? "MTKattentionIgnoredThread7345" : "MTKattentionIgnoredThread";
assert.equal(count(source, `s=s.filter(t=>!${ignoredThreadName}(e,t,c))`), 1,
  "only the stock unread-task subset is filtered for global attention counts");
assert.equal(count(source, "electron-set-badge-count"), 1,
  "dock badge owner remains stock and consumes the shared global unread count");
assert.ok(source.includes("unreadRunCount:r"), "automation unread count remains stock");
assert.ok(source.includes("c=e(MTKattentionPolicyAtom)"),
  "global unread count depends on the asynchronously installed policy atom");
assert.ok(!helper.includes("MutationObserver"), "policy adds no watcher");

process.stdout.write(`${JSON.stringify({
  state: "green",
  policy: ".codex/task-attention-policy.json",
  ownerCardinality: "exactly-one",
  matches: "full-title-or-full-task-id",
  suppressed: ["sidebar-completion-attention", "sidebar-waiting-treatment", "native-turn-complete-notification", "dock-and-collapsed-sidebar-unread-count"],
  preserved: ["running", "failure", "task-output", "approval-and-input-notification-owners", "destination-task-alerts", "automation-and-unrelated-global-unread-counts"],
  startupFallback: "invalid-missing-or-ambiguous-policy-is-vanilla",
  reloadFallback: "invalid-missing-or-ambiguous-replacement-keeps-last-good-policy"
}, null, 2)}\n`);

function directory(target) {
  files.set(target, { metadata: { isDirectory: true, isFile: false, isSymlink: false }, contents: "" });
}

function file(target, contents) {
  files.set(target, { metadata: { isDirectory: false, isFile: true, isSymlink: false }, contents });
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
