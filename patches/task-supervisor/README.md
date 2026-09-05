# Task supervisor

**State:** Benched

This patch can give one exact persistent Codex task a bounded startup prompt or wake it after a
configured idle interval. It exists for cases where an application-local task must keep servicing
a bridge even though Codex supplies no durable service primitive for that job.

The operational kit originally used it to keep a Tinrelay radio-room task listening. Tinrelay's
model-free CLI wait loop now owns that job more directly, so this patch is deliberately absent from
the toolkit's example `enabledPatches`. Extraction preserves a useful escape hatch without claiming
that it should be installed.

## Owned seam

The transform recognizes one of two exact renderer profiles in `app-initial-*.js` and composes with
the already-installed attention-policy and palette bootstrap owner. It adds one renderer-local
supervisor guarded by a Web Lock so only one window acts as owner.

At runtime it reads `$CODEX_HOME/task-supervision.json`, located from one authoritative user config
layer. A missing or invalid file disables supervision. The file must contain only a `tasks` array;
each rule selects either one exact UUID `taskId` or one unique `titlePattern`, and chooses:

- `on_start`: send one prompt when the renderer starts;
- `keep_alive`: send after `idleSeconds`, with a five-second minimum.

Exact IDs outrank title patterns. A title pattern matching more than one task is skipped. Before
every automated turn, the supervisor rereads the task, resumes an unloaded task when necessary,
and requires authoritative idle state. A recovery that completes before its idle interval opens a
prompt-storm fuse until human activity or restart.

Example runtime configuration:

```json
{
  "tasks": [
    {
      "titlePattern": "^local-bridge(?:\\b|$)",
      "mode": "keep_alive",
      "prompt": "continue",
      "idleSeconds": 10
    }
  ]
}
```

## Compatibility evidence

Synthetic fixtures cover the exact build-`7746` and build-`7942` renderer profiles. The behavioral
probe exercises parsing, config discovery, exact-ID precedence, ambiguous-title rejection,
unloaded-task resume, idle wakeup, cancellation on activity, one-shot startup, duplicate ownership,
and the rapid-completion fuse.

```sh
node test/task-supervisor-transform.test.mjs
```

The build-`7982` stock bundle was also checked after applying its required palette and attention
dependencies: the supervisor applied idempotently and its behavioral probe passed. This is static
evidence, not a claim that the benched patch is installed or live-qualified.

## Non-goals

- It is not a general scheduler, daemon, automation service, or retry framework.
- It does not infer a task from a non-unique title.
- It does not replace Tinrelay's transport listener or native task-to-task messaging.
- It does not install itself, edit runtime configuration, or broaden the authority of a prompt.
- It should not be enabled merely because a persistent task exists.
