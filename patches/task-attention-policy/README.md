# Task attention policy

- **Current state:** Active
- **Public extraction:** Complete for the standalone transform
- **Current evidence:** Codex Desktop `26.901.41123`, build `7942`, inspected 2026-09-05

## Why it exists

Some persistent utility tasks do useful work without needing to light the entire bridge every time
they finish. Their output should remain available and their failures should remain visible, but a
routine completion does not always deserve a sidebar unread marker, Dock badge, or native
notification.

This patch lets an operator identify those tasks with anchored regular expressions. A match mutes
only completion attention; it does not hide, archive, pause, cancel, mark read, or alter the task.
Running state, output, errors, approvals, input requests, and ordinary destination-task alerts stay
visible.

## Configuration

Copy [`toolkit.example.json`](../../toolkit.example.json) outside version control and set
`workspaceRoot` to the directory that owns the runtime policy. The patch embeds only that absolute
root; the application then loads `.codex/task-attention-policy.json` through its existing local App
Server filesystem boundary.

The policy has one key. Each expression is tested against the complete genuine task title and task
ID, never message prose or delegation text:

```json
{
  "ignore": [
    "^utility-task$",
    "^documentation(?:-| )research$"
  ]
}
```

See [`policy.example.json`](policy.example.json). Invalid JSON, an invalid expression, unknown
policy keys, unsafe filesystem metadata, a policy over 16 KiB, or a missing file produces ordinary
Codex attention. Current builds have one explicit configured owner; older retained profiles may
discover exactly one owner among local project roots.

With [runtime JSON reload](../runtime-json-reload/) selected, a complete valid external save takes
effect without restarting Codex. The existing parser is the acceptance callback: malformed,
partial, missing, oversized, or unsafe replacements are rejected while the last-good policy keeps
running.

## Owned seam

The transform joins four stock ownership surfaces:

1. the task-row projections for unread, approval, waiting, and hover-card attention;
2. the global unread selector that feeds the Dock and collapsed-sidebar counts;
3. the native turn-complete notification owner; and
4. the app bootstrap and state atom that load and publish the policy.

It resolves title and ID from Codex's actual task metadata. Missing, duplicated, partial, or changed
owners stop the transform with `Upstream changed`; it does not infer provenance from visible text.

## Check and apply

`check` is read-only and needs no configuration. `apply` requires a JSON config because this public
transform will not guess or carry a private workspace path.

```sh
node bin/toolkit.mjs patch task-attention-policy check /path/to/extracted-asar
node bin/toolkit.mjs patch task-attention-policy apply /path/to/disposable-extracted-asar \
  --config /path/to/toolkit.local.json
node test/task-attention-policy.test.mjs /path/to/disposable-extracted-asar /path/to/workspace
```

The patch command modifies only the supplied extracted tree. The separate staging command can build
and statically verify a new app outside `/Applications`; neither command installs, launches, or
replaces a working application.

## Verification

`test/task-attention-policy-transform.test.mjs` creates a synthetic pristine build-`7942` pair of
renderer owners and a fictional configured workspace. It proves that applying without config is
refused, the configured root is safely quoted into the transform, the behavioral bundled-contract
probe passes, and a second application is byte-identical.

The operational build-`7942` patch was accepted in live use before extraction: ignored utility-task
completion did not create task attention, a native notification, or a Dock badge, while an ordinary
task still did. This repository preserves that evidence as historical context; it does not claim
that the separately namespaced public transform has been installed.

## Non-goals

- muting approvals, questions, errors, or active work;
- matching message bodies or sender labels;
- editing policy from the Codex UI;
- patching an application bundle in place;
- accepting an approximately matching future build.
