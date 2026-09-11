const definitions = [
  {
    name: "standalone-output-compaction",
    patch: "source-patches/standalone-output-compaction/codex-0.154.0-alpha.6.1.patch",
    upstream: "https://github.com/openai/codex",
    tag: "rust-v0.154.0-alpha.6.1",
    commit: "9db71b9871a5a63c3d1eae16184d872ea388bfdf",
    desktop: {version: "26.908.31457", build: "8690"},
    files: {
      "codex-rs/core/src/compact.rs": {
        before: "67c16bf477530a1cad9e4f0643b9fe797fe66f05ca0c4154dec06e6f18277383",
        after: "a26c6c01f5f5d59b885bd895b4fa4ffc05062b6300920d52a840fd0f52e72054"
      },
      "codex-rs/core/src/compact_remote.rs": {
        before: "f309fd541d8399696c6f75bb40d9f76a8be6d0b49a12630efadf8d07352f71c5",
        after: "3215dd11fbb57273f5be612be075e0b5edc48f7864951b97810decf4fd9421fc"
      },
      "codex-rs/core/src/compact_remote_metadata_tests.rs": {
        before: "36eb1f76ab4ee09e013851a03490cbfc3335c419d4c6c0fffc709cd1ce4ae480",
        after: "324ef81fcbafc2b8d5e8b73a438c415afec10f15e617689fe02a7ad3dd10867c"
      },
      "codex-rs/core/src/compact_remote_v2.rs": {
        before: "12adeab8d1e307c6cf35dea979a891a7bcd027ea3eac2e7728751f8f1887da61",
        after: "b04531ef34a2aa25030bdf61588d1a82271fb5ce317389ad0f992240f24b07ea"
      },
      "codex-rs/core/src/compact_tests.rs": {
        before: "b80f08be1d21be450bde096522704c17fa181b13045a93e2913cb2794e4eff23",
        after: "af40a0a2a6f603408771af90986ff537a3ca818d31409dc9f1bcfb679f6edaf7"
      }
    }
  }
];

if (new Set(definitions.map(definition => definition.name)).size !== definitions.length) {
  throw new Error("Source patch catalog contains duplicate names");
}

export const sourcePatchDefinitions = Object.freeze(definitions.map(definition => Object.freeze({
  ...definition,
  desktop: Object.freeze({...definition.desktop}),
  files: Object.freeze(Object.fromEntries(
    Object.entries(definition.files).map(([file, hashes]) => [file, Object.freeze({...hashes})])
  ))
})));

export function sourcePatchDefinition(name) {
  return sourcePatchDefinitions.find(definition => definition.name === name) ?? null;
}
