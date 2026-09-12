# Standalone-output compaction

Preserves a current agent-to-agent or other standalone external input when it is the turn that
crosses a context-compaction boundary. Without this repair, compaction can discard that input and
leave the resumed agent acting coherently on an obsolete checkpoint—the observed "time travel"
failure.

## What the person sees

The agent receives a new request and may even perform part of it correctly. If the turn compacts,
the agent can then wake up at an older, already-finished request and treat that as the current job.
From the chat surface, it looks like the agent abruptly traveled backward: it repeats old work,
answers a question nobody just asked, contradicts files or tool results it produced moments ago,
or sends a confident report about the wrong task. Repeating an older state-changing instruction can
also be materially unsafe.

This repair keeps the actual incoming instruction in the compacted history with its external
provenance intact. That matters because the agent should finish the request that was truly delivered,
not infer its job from whichever older user-shaped message happened to remain visible.

## Known upstream reports

- [`openai/codex#42695`](https://github.com/openai/codex/issues/42695) documents the directly
  repaired path: a `send_message_to_thread` instruction begins executing, compaction drops that
  current instruction, and the agent resumes an obsolete completed task and produces an incorrect
  execution report.
- [`openai/codex#42611`](https://github.com/openai/codex/issues/42611) documents a related but
  broader symptom in an ordinary CLI turn: an already-answered user message is treated as newly
  submitted after compaction. This patch does not claim to fix that separate input shape.
- [`openai/codex#42460`](https://github.com/openai/codex/issues/42460) documents an earlier
  cross-thread failure in which a delegation card appears but the prompt body never enters the
  receiving model's context. That is a pre-execution delivery failure, not the mid-turn compaction
  loss fixed here.

The three reports can look similar to a person because each may surface as irrelevant or repeated
work. Their event shapes differ, so the toolkit keeps the patch claim narrow.

The defect is in the open-source Codex App Server/Core, not the desktop renderer. App-server inputs
such as `send_message_to_thread` are recorded as standalone `FunctionCallOutput` items with no
`call_id`, specifically so they keep external provenance rather than impersonating a user message.
The affected compaction paths did not retain that newer input shape. This patch retains only those
unpaired external items, caps each at 10,000 estimated tokens, and leaves ordinary paired tool
results discardable.

## Qualified source

[`codex-0.154.0-alpha.6.2.patch`](codex-0.154.0-alpha.6.2.patch) applies only to OpenAI Codex tag
`rust-v0.154.0-alpha.6.2`, commit `b5bffd3ec4db487e7e3dec59663875b0ef7b72ca`. Codex Desktop
`26.908.40834` (build `8881`) bundles that same CLI version, and the qualified desktop fleet
integrates the patched binary. The source-patch command verifies the exact commit and every target
file's qualified before or after hash.

```sh
node bin/toolkit.mjs source-patch standalone-output-compaction check /path/to/codex
node bin/toolkit.mjs source-patch standalone-output-compaction apply /path/to/codex
```

For another Codex revision, port the behavior and tests deliberately. Do not widen or force the
old diff.

## Build and verify

From the patched checkout:

```sh
cd codex-rs
just test -p codex-core compact_remote_v2::tests::build_v2_compacted_history_filters_to_installed_retention_shape
just test -p codex-core compact_remote::metadata_tests::compacted_history_keeps_only_standalone_function_outputs
just test -p codex-core compact::tests::insert_initial_context_before_standalone_function_output
cargo build --release --bin codex
```

The complete `codex-core` package gate remains worthwhile in a fully provisioned build environment.
It requires helper binaries and sandbox facilities beyond the focused tests.

## Desktop integration

Building produces `codex-rs/target/release/codex`. Set `codexBinary` in the private toolkit config
to that absolute path, enable the desktop package patch named `standalone-output-compaction`, and
run the normal staged-app flow. The package transform verifies that the built binary reports the
same CLI version as the vendor bundle before copying it into the candidate.

Source application, compilation, desktop staging, application replacement, and live acceptance
are separate authority and verification seams. The toolkit distributes neither upstream source
nor a compiled Codex binary. Rollback restores the untouched vendor app; no rollout rewrite is
required because this repair changes future compaction boundaries.
