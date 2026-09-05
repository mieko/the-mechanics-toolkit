const definitions = [
  {
    name: "cross-task-attribution",
    script: "patches/cross-task-attribution/patch.mjs",
    probe: "test/cross-task-attribution.test.mjs"
  },
  {
    name: "task-visual-palette",
    script: "patches/task-visual-palette/patch.mjs",
    probe: "test/task-visual-palette.test.mjs",
    config: true,
    probeWorkspaceRoot: true,
    requires: ["cross-task-attribution"]
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
    probeWorkspaceRoot: true
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
    name: "renderer-patch-registry",
    script: "patches/renderer-patch-registry/patch.mjs",
    probe: "test/renderer-patch-registry.test.mjs"
  }
];

if (new Set(definitions.map(definition => definition.name)).size !== definitions.length) {
  throw new Error("Patch catalog contains duplicate names");
}

export const patchDefinitions = Object.freeze(definitions.map(definition => Object.freeze({
  ...definition,
  requires: Object.freeze(definition.requires ?? [])
})));

export function patchDefinition(name) {
  return patchDefinitions.find(definition => definition.name === name) ?? null;
}
