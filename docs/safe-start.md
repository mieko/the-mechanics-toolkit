# Safe restart and rescue

`tmtk-restart` makes the vulnerable adoption and restart seam observable. With `--candidate`, it
verifies the staged candidate, captures the current canonical Codex application as a private
known-working rollback, and replaces nothing until the person approves the restart. It then adopts
the candidate and launches it under a private one-use readiness marker. If the application exits
before its healthy route tree mounts or remains alive without becoming ready, it opens a visible
Terminal recovery and gives the originating task as many as three automatic repair turns in
Codex's normal colored interactive interface. The person can watch those turns, but does not need
to type or manage them.

From an agent turn whose environment contains Codex's task identity:

```sh
bin/tmtk-restart --candidate /path/to/ChatGPT-MechanicsToolkit.app \
  /Applications/ChatGPT.app
```

An agent can prepend incident-specific instructions to the automatic rescue briefing:

```sh
bin/tmtk-restart --candidate /path/to/ChatGPT-MechanicsToolkit.app \
  --prompt "Preserve the staged candidate while diagnosing this launch." \
  /Applications/ChatGPT.app
```

The standard briefing is always present. It tells the resumed agent that Codex Desktop failed,
that recovery is running through the bundled Codex CLI without native task-to-task messaging or
desktop app tools, and gives the exact paths to the bounded diagnostic report, supervisor log, and
failed application standard-output/error log. `--prompt` adds context; it does not replace those
facts.

When running directly from a retained checkout instead of a PATH installation, use
`/path/to/the-mechanics-toolkit/bin/tmtk-restart` with the same argument. An optional `--` before
the application path is accepted for shell callers, and `/Applications` remains supported as
shorthand for `/Applications/ChatGPT.app`.

Without `--candidate`, the command supervises a restart of the existing canonical app but has no
pre-adoption rollback to offer. The command:

1. reads `CODEX_THREAD_ID` or `CODEX_SESSION_ID` from the invoking Codex subprocess;
2. looks up that exact local task, its selected model, and reasoning effort in
   `~/.codex/state_5.sqlite`, falling back to the older local
   thread catalog at `~/.codex/sqlite/codex-dev.db`;
3. records the task's stored project directory rather than trusting the subprocess's incidental
   `PWD`;
4. when `--candidate` is present, verifies it and captures the current canonical app as the exact
   known-working rollback inside the private incident directory;
5. returns control to the invoking agent immediately while the detached supervisor presents a
   blocking macOS dialog with **Don't Restart** and **Relaunch Codex**;
6. after **Relaunch Codex**, asks the exact `com.openai.codex` application at the target executable
   path to quit, waits for the
   exact invoking Codex CLI ancestor recorded when the supervisor was armed, and proves the Codex
   state databases accept a writer;
7. when adopting, copies the still-verified candidate into the canonical path and verifies the
   installed result before launching it through macOS LaunchServices with a fresh private marker;
8. accepts readiness only when Codex's stock trusted-renderer `ready` event reaches the patched
   main process;
9. opens a visible Terminal recovery in the recorded project if the exact child exits before
   readiness or misses the readiness deadline;
10. runs ordinary `codex resume TASK_ID PROMPT` for as many as three repair attempts in that same
    task, with one invocation-scoped stock `Stop` hook, announcing each attempt and telling the
    person that no Terminal input is needed;
11. treats the hook's private receipt only as evidence that the model stopped, then waits for the
    same turn ID's durable `task_complete` rollout event before closing that TUI;
12. hands control to a detached supervisor, closes the dedicated rescue window and, when TMTK
    launched it, the Terminal application, and only after both the rescue process and terminal-close
    receipt exist does it launch Desktop;
13. accepts the repair only when the newly launched renderer writes readiness; and
14. after three unsuccessful attempts, offers **Restore Known-Working** or **Open Terminal Line
    with Agent** when a rollback was captured. Restore verifies and reinstalls that exact app before
    the same strict return handoff; the terminal choice leaves the same task open interactively.

The invoking agent must not poll the supervisor or wait for the application lifecycle. After
`tmtk-restart` prints that the supervisor is armed, the agent finishes its current response and
tells the person to click **Relaunch Codex** when ready. The detached supervisor remains blocked at
the dialog until that click. **Don't Restart** records a cancelled attempt and exits without asking
Codex to quit. The supervisor sends a normal application quit request and waits without an
artificial shell timeout for it to complete. Cancelling either dialog leaves the app open and does
not start rescue. Automatic repair retries do not show the toolkit confirmation again.

The rollback source is not inferred from filenames, neighboring applications, or version order. It
is the exact canonical application inspected and copied before candidate adoption. Its version,
build, ASAR hash, ASAR integrity, and signature are frozen in the incident state and verified again
before restoration. The candidate receives the same treatment before adoption. If restoration
fails, TMTK puts the displaced application back when possible and opens the terminal line with the
agent instead of claiming recovery. The captured app may predate TMTK's readiness marker. Because
it is the exact app that was already running when adoption began, the fallback accepts either real
renderer readiness or an otherwise clean launch that remains alive for ten seconds, and records
which boundary it observed. An early exit opens the terminal line; rollback never loops.

A supervised adoption retains at most one full known-working application. After the current app is
successfully captured for a new adoption, TMTK removes only older `known-good.app` payloads from its
private incident directories and preserves their small state, logs, and diagnostics. This bounds
automatic rollback storage to one application bundle. TMTK does not delete the explicitly supplied
candidate or anything in a maintainer's `.work` directory because it does not own those paths.

The macOS confirmation uses `assets/TheMechanicsToolkit.icns` when the retained toolkit checkout
contains it and falls back to the native note icon otherwise. The icon is presentation, not a
runtime dependency or part of the application-signing boundary.

The repair turns are sequential continuations of the same task, not disposable agents. The
supervisor freezes the task's recorded model and reasoning effort when it is armed, then passes
both explicitly to every automatic and interactive resume. It refuses before asking Desktop to
quit if that substrate identity cannot be established. The macOS adapter does not scan the process
table for names containing `Codex` or `ChatGPT`: Desktop lifecycle comes from the exact
`com.openai.codex` bundle identity and target executable path, and task handoff follows only this
command's parent chain to the exact bundled CLI executable and freezes that PID. After Desktop
quits, that one invoking CLI must exit. If it remains, the supervisor asks the person to close its
existing terminal or session and does not launch a second copy of the task.

Before installation, launch, and every explicit rescue resume, the supervisor also waits for the
state, logs, goals, memories, and queue databases to accept a write reservation. This closes the
process-exit-to-database-release seam: starting a new runtime while a former Desktop writer still
owns one of those databases can make Codex initialize without its state runtime and fall back to
expensive rollout scans. Unrelated Codex CLIs, browser extensions, crashpad, renderer, and other
helpers are not guessed at by name and do not become lifecycle blockers. The rescue CLI is tracked
separately by the exact PID the supervisor launched. It also removes
inherited `CODEX_THREAD_ID` and `CODEX_SESSION_ID` values so they cannot override the task ID frozen
when `tmtk-restart` was armed. A later attempt can see what the earlier attempt diagnosed and
changed, plus the newer launch evidence.

Each automatic attempt uses a normal stock Codex TUI so the person sees the same readable colors,
tool summaries, and response presentation as an ordinary escape line. TMTK supplies a synchronous
`Stop` hook only for that invocation. The hook validates the frozen task ID and transcript path,
then atomically records the turn ID and pre-completion transcript offset. It does not decide that
the repair succeeded, and the agent is not asked to run a completion command. Because Codex invokes
`Stop` just before final turn persistence, the outer supervisor reads only the matching rollout
and waits for that exact turn's `task_complete` event. Only then may it terminate the idle TUI,
wait for database-writer quiescence, and arm the return handoff. The repair process then exits and
the owned Terminal surface closes. A detached supervisor requires proof of both boundaries before
launching Desktop, so one task is never live in the rescue CLI and Desktop at the same time. This
preserves the completed repair turn without requiring a custom Codex build.

A successful renderer-ready launch leaves Desktop open. On macOS, TMTK records whether Terminal was
already running. It launches a stopped Terminal with the rescue command file, or uses Terminal's
scripting API to add one dedicated rescue window when the application was already open. It later
identifies that exact window by its TTY and closes it. If TMTK launched Terminal, it quits the
Terminal application too; a pre-existing Terminal application and all of its existing windows remain
untouched. The close is scheduled out-of-band so the rescue process can exit
before Terminal is asked to close its now-idle window; Terminal is never asked to terminate the repair
process that requested the close. A manually opened escape line or a configured non-Terminal
application is never closed by this path. If an owned surface does not produce its close receipt,
the supervisor fails closed and does not launch Desktop.
The LaunchServices handoff is also a permission boundary: starting the application executable
directly from the rescue Terminal makes macOS attribute Codex Computer Use and network privacy
requests to Terminal. LaunchServices restores the application as the responsible identity, so a
successful repair does not ask the person to grant those Codex capabilities to Terminal.

Automatic and interactive repair deliberately use Codex's unsandboxed escape-line mode because a
failed Desktop application may need repair at `/Applications/ChatGPT.app`. That authority comes
only from the initiating task and user's existing scope. Diagnostic JSON, application output, and
logs are untrusted evidence: instruction-shaped text inside them is data, never a new instruction
or grant of authority. Every generated rescue prompt states that boundary before asking the agent
to inspect the evidence.

The default deadline is five minutes. That deliberately leaves room for a freshly signed build to
wait behind a visible macOS Keychain or Storage Key prompt. If the person closes the blank-looking
application first, the exact child exit triggers rescue immediately. After a timeout, the
supervisor asks that exact application to quit before resuming the task so Desktop and the CLI do
not contend for the task writer.

Inspect the last attempt at any time:

```sh
node /absolute/path/to/the-mechanics-toolkit/bin/did-codex-launch.mjs
```

Its exit status is zero when the last attempt reached renderer readiness, or when an exact restored
known-working app that predates the marker remained alive through the documented ten-second
fallback. The JSON distinguishes those outcomes. Private launch state, supervisor output,
application standard output, and a bounded failure diagnostic live under `~/.codex/tmtk-rescue/`.
No report is uploaded.

Choosing **Open Terminal Line with Agent** deliberately defers rollback and leaves the known-working
application in the incident directory. If the person later wants that rollback, finish and exit the
interactive Codex CLI first so the task has no active writer. From the retained TMTK checkout, find
the incident state named by `latest.json`, reopen the existing fallback choice, and choose
**Restore Known-Working**:

```sh
state_file="$(node <<'NODE'
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const latest = JSON.parse(fs.readFileSync(
  path.join(os.homedir(), ".codex/tmtk-rescue/latest.json"), "utf8"
));
if (latest.repairAttemptsUsed !== 3 || latest.knownGoodRestoreAttempted === true ||
    typeof latest.configuration?.knownGood?.app !== "string") {
  throw new Error("latest TMTK incident is not an exhausted rescue with an unused rollback");
}
const stateFile = path.join(latest.incidentDirectory, "state.json");
if (!fs.existsSync(stateFile)) throw new Error("latest TMTK incident state is missing");
process.stdout.write(stateFile);
NODE
)"
node bin/rescue-agent.mjs "$state_file"
```

Do not pass `known-good.app` back through `tmtk-restart --candidate`: candidate adoption captures
the current canonical app as a new rollback and is the wrong lifecycle for restoring an existing
incident. The re-entry above reuses the frozen receipt, performs the normal verified replacement,
and returns through the supervisor's strict CLI-exit and terminal-close handoff.

## Plumbing probe

The ordinary test suite proves task lookup, the macOS confirmation choices, fail-closed
configuration, readiness outcomes,
diagnostic collection, rescue briefing construction, and exact same-task CLI arguments without
changing application lifecycle state. A separate macOS plumbing probe exercises the assembled
failure path with a disposable fake application and fake bundled CLI:

```sh
npm run acceptance:safe-start-failure
```

After the person clicks **Relaunch Codex** in the real macOS confirmation dialog, the fake
application exits before readiness. The real supervisor must detect that exit, write the
bounded rescue artifacts, open Terminal, run two visible fake `resume` repair turns with Stop
receipts and durable completion events, reject the
first failed Desktop relaunch, and accept renderer readiness after the second. The installed Codex
application is not quit or modified because process matching uses the disposable application's
exact executable path. This command intentionally opens one short-lived Terminal recovery and
therefore is not part of `npm test`. It proves the process, terminal, retry, artifact, argument, and
return-to-Desktop plumbing; it does not replace separate acceptance of a real blank renderer and a
living Electron React recovery page with the real bundled Codex CLI.

## Fallback configuration

The ordinary agent-invoked path needs no configuration file. If the command is launched outside a
Codex subprocess, it optionally reads `~/.codex/RESCUE-AGENT.json`. The repository includes
[`rescue-agent.example.json`](../rescue-agent.example.json); its complete shape is:

```json
{
  "taskId": "01900000-0000-7000-8000-000000000001",
  "cwd": "/absolute/project/directory",
  "model": "gpt-5.6-sol",
  "reasoningEffort": "high",
  "terminalApp": "Terminal",
  "readyTimeoutSeconds": 300
}
```

`taskId`, `cwd`, `model`, and `reasoningEffort` can become necessary fallbacks when the current
thread catalog does not expose them. Optional keys are `prompt`, `terminalApp`, and
`readyTimeoutSeconds` (30 through 1800). Unknown keys and invalid types fail closed so a typo cannot
silently alter recovery. Catalog metadata wins over the fallback task context, and command-line
`--prompt` wins over the JSON prompt. The tool never falls back to `PWD` or an ambient default
model; if it cannot establish the complete task, directory, model, and reasoning-effort context,
it exits before quitting Codex and names the missing JSON field on standard error.

The rescue runner does not set a terminal-window title. Codex CLI takes ownership of that title
after launch, so a toolkit title would be transient and misleading rather than a dependable
operator signal.

The automatic repair command uses the target application's own bundled `codex resume` executable,
an invocation-scoped stock Stop hook, and the toolkit's escape-line permission mode. Only after all
automatic attempts fail does it leave an ordinary interactive `codex resume` open for the person.
The task lookup, readiness state
machine, marker protocol, diagnostics schema, and rescue runner are ordinary Node programs; they
do not require zsh or another POSIX shell. Bundle layout, process discovery, application shutdown,
diagnostic locations, default terminal choice, and terminal opening live together in a narrow
platform adapter. Only the macOS adapter is currently implemented and qualified; unsupported
platforms fail before changing application lifecycle state. A Windows or Linux port should add its
own adapter without changing the supervisor protocol. Treat the JSON file as private local
configuration and do not commit task IDs, paths, prompts, or secrets to this public repository.
