# Safe restart and rescue

`tmtk-restart` makes the vulnerable restart seam observable. It launches the exact canonical Codex
application under a private one-use readiness marker and opens the originating Codex task in a
terminal if the application exits before its healthy route tree mounts or remains alive without
becoming ready.

From an agent turn whose environment contains Codex's task identity:

```sh
tmtk-restart /Applications/ChatGPT.app
```

An agent can prepend incident-specific instructions to the automatic rescue briefing:

```sh
tmtk-restart --prompt "Preserve the staged candidate while diagnosing this launch." \
  /Applications/ChatGPT.app
```

The standard briefing is always present. It tells the resumed agent that Codex Desktop failed,
that it is now operating in the Codex CLI without native task-to-task messaging or desktop app
tools, and gives the exact paths to the bounded diagnostic report, supervisor log, and failed
application standard-output/error log. `--prompt` adds context; it does not replace those facts.

When running directly from a retained checkout instead of a PATH installation, use
`/path/to/the-mechanics-toolkit/bin/tmtk-restart` with the same argument. An optional `--` before
the application path is accepted for shell callers, and `/Applications` remains supported as
shorthand for `/Applications/ChatGPT.app`.

The command:

1. reads `CODEX_THREAD_ID` or `CODEX_SESSION_ID` from the invoking Codex subprocess;
2. looks up that exact local task in `~/.codex/state_5.sqlite`, falling back to the older local
   thread catalog at `~/.codex/sqlite/codex-dev.db`;
3. records the task's stored project directory and title rather than trusting the subprocess's
   incidental `PWD`;
4. asks the existing canonical application to quit, waits for its exact executable to stop, and
   launches that executable with a fresh private marker path;
5. accepts readiness only when Codex's stock trusted-renderer `ready` event reaches the patched
   main process; and
6. opens a terminal rescue in the recorded project and resumes the same task if the exact child
   exits before readiness or misses the readiness deadline.

The default deadline is five minutes. That deliberately leaves room for a freshly signed build to
wait behind a visible macOS Keychain or Storage Key prompt. If the person closes the blank-looking
application first, the exact child exit triggers rescue immediately. A timeout opens rescue but
does not kill the application.

Inspect the last attempt at any time:

```sh
did-codex-launch
```

Its exit status is zero only when the last attempt reached renderer readiness. Private launch state,
supervisor output, application standard output, and a bounded failure diagnostic live under
`~/.codex/tmtk-rescue/`. No report is uploaded.

## Fallback configuration

The ordinary agent-invoked path needs no configuration file. If the command is launched outside a
Codex subprocess, it optionally reads `~/.codex/RESCUE-AGENT.json`. The repository includes
[`rescue-agent.example.json`](../rescue-agent.example.json); its complete shape is:

```json
{
  "taskId": "01900000-0000-7000-8000-000000000001",
  "cwd": "/absolute/project/directory",
  "title": "Recovery task",
  "terminalApp": "Terminal",
  "readyTimeoutSeconds": 300
}
```

Only `taskId` and `cwd` can become necessary fallbacks. Optional keys are `title`, `prompt`,
`terminalApp`, and `readyTimeoutSeconds` (30 through 1800). Unknown keys and invalid types fail
closed so a typo cannot silently alter recovery. Catalog metadata wins over fallback directory and
title values, and command-line `--prompt` wins over the JSON prompt. The tool never falls back to
`PWD`; if it cannot establish task identity or a usable
project directory, it exits before quitting Codex and names the missing JSON field on standard
error.

The rescue command uses the target application's own bundled `codex` executable and resumes the
exact task with the toolkit's escape-line permission mode. The task lookup, readiness state
machine, marker protocol, diagnostics schema, and rescue runner are ordinary Node programs; they
do not require zsh or another POSIX shell. Bundle layout, process discovery, application shutdown,
diagnostic locations, default terminal choice, and terminal opening live together in a narrow
platform adapter. Only the macOS adapter is currently implemented and qualified; unsupported
platforms fail before changing application lifecycle state. A Windows or Linux port should add its
own adapter without changing the supervisor protocol. Treat the JSON file as private local
configuration and do not commit task IDs, paths, prompts, or secrets to this public repository.
