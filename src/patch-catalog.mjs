const definitions = [
  {
    name: "cross-task-attribution",
    script: "patches/cross-task-attribution/patch.mjs",
    probe: "test/cross-task-attribution.test.mjs"
  },
  {
    name: "runtime-json-reload",
    script: "patches/runtime-json-reload/patch.mjs",
    probe: "test/runtime-json-reload.test.mjs",
    config: true
  },
  {
    name: "task-visual-palette",
    script: "patches/task-visual-palette/patch.mjs",
    probe: "test/task-visual-palette.test.mjs",
    config: true,
    probeWorkspaceRoot: true,
    requires: ["cross-task-attribution", "runtime-json-reload"]
  },
  {
    name: "reasoning-retention",
    script: "patches/reasoning-retention/patch.mjs",
    probe: "test/reasoning-retention.test.mjs",
    requires: ["task-visual-palette"]
  },
  {
    name: "macos-menu-title",
    script: "patches/macos-menu-title/patch.mjs",
    probe: "test/macos-menu-title.test.mjs",
    scope: "app"
  },
  {
    name: "sidebar-action-collapse",
    script: "patches/sidebar-action-collapse/patch.mjs",
    probe: "test/sidebar-action-collapse.test.mjs"
  },
  {
    name: "task-attention-policy",
    script: "patches/task-attention-policy/patch.mjs",
    probe: "test/task-attention-policy.test.mjs",
    config: true,
    probeWorkspaceRoot: true,
    requires: ["runtime-json-reload"]
  },
  {
    name: "terminal-toggle",
    script: "patches/terminal-toggle/patch.mjs",
    probe: "test/terminal-toggle.test.mjs"
  },
  {
    name: "outgoing-message-receipt",
    script: "patches/outgoing-message-receipt/patch.mjs",
    probe: "test/outgoing-message-receipt.test.mjs"
  },
  {
    name: "tinrelay-pointer-presentation",
    script: "patches/tinrelay-pointer-presentation/patch.mjs",
    probe: "test/tinrelay-pointer-presentation.test.mjs",
    config: true
  },
  {
    name: "native-app-tools-peer-authorization",
    script: "patches/native-app-tools-peer-authorization/patch.mjs",
    probe: "test/native-app-tools-peer-authorization.test.mjs"
  },
  {
    name: "full-history-drain-suppression",
    script: "patches/full-history-drain-suppression/patch.mjs",
    probe: "test/full-history-drain-suppression.test.mjs"
  },
  {
    name: "renderer-turn-window",
    script: "patches/renderer-turn-window/patch.mjs",
    probe: "test/renderer-turn-window.test.mjs"
  },
  {
    name: "task-supervisor",
    script: "patches/task-supervisor/patch.mjs",
    probe: "test/task-supervisor.test.mjs",
    requires: ["task-attention-policy", "task-visual-palette"]
  },
  {
    name: "renderer-patch-registry",
    script: "patches/renderer-patch-registry/patch.mjs",
    probe: "test/renderer-patch-registry.test.mjs"
  }
];

if (new Set(definitions.map(definition => definition.name)).size !== definitions.length) {
  throw new Error("Patch catalog contains duplicate names");
}
if (definitions.some(definition => !new Set(["asar", "app"]).has(definition.scope ?? "asar"))) {
  throw new Error("Patch catalog contains an unknown scope");
}

export const patchDefinitions = Object.freeze(definitions.map(definition => Object.freeze({
  ...definition,
  scope: definition.scope ?? "asar",
  requires: Object.freeze(definition.requires ?? [])
})));

export function patchDefinition(name) {
  return patchDefinitions.find(definition => definition.name === name) ?? null;
}
