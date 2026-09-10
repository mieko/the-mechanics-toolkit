const definitions = [
  {
    name: "standalone-output-compaction",
    patch: "source-patches/standalone-output-compaction/codex-0.153.4.patch",
    upstream: "https://github.com/openai/codex",
    tag: "rust-v0.153.4",
    commit: "3d2ee51ca2d5db578f328aa75e20aa22c0197c9a",
    desktop: {version: "26.903.61454", build: "8378"},
    files: {
      "codex-rs/core/src/compact.rs": {
        before: "3f3324a1073d6896805c446ea6ebd2983200f0c04eef2188147bfb51b3486567",
        after: "77e2ad42bc4cd004a4c68bfbf9adcccaa2f1d8d038227102db6b07824c182465"
      },
      "codex-rs/core/src/compact_remote.rs": {
        before: "5a51af2ac0a0d083a3e31ff7de5ac1607a91ac20ee904c807faa059dd92bff96",
        after: "ccc0ba17d5c8cf9e1030beeca365722546318c096781b822e268e95b90d9ce62"
      },
      "codex-rs/core/src/compact_remote_metadata_tests.rs": {
        before: "36eb1f76ab4ee09e013851a03490cbfc3335c419d4c6c0fffc709cd1ce4ae480",
        after: "324ef81fcbafc2b8d5e8b73a438c415afec10f15e617689fe02a7ad3dd10867c"
      },
      "codex-rs/core/src/compact_remote_v2.rs": {
        before: "080a7c3ff1dc0de3c0f7f83b9887609882a4fa7374f24ef48e0fe423f04e5eed",
        after: "4355c04578a12cb9aa127ffc331908429e193416804190513efd1bd7886370a9"
      },
      "codex-rs/core/src/compact_tests.rs": {
        before: "1f89e4537a34a1876c9ce99e4fa3012b5465d5e8359440bf442363e3d8d03ae2",
        after: "b821163962bcaae71420fbe30a243ba8e3359019ea075bc84dc845a864029786"
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
