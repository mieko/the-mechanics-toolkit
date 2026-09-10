# Reasoning retention

- **Current state:** Active
- **Public extraction:** Complete
- **Patch-specific evidence:** Build `8109` static stage and live next-turn/manual-state acceptance green,
  2026-09-07

## Why it exists

Codex normally collapses a turn's reasoning and tool activity as soon as the final answer begins. For
ordinary task work that keeps the transcript compact. For a continuing agent, it can hide the
actual judgment at exactly the moment a shorter close-out paraphrase appears beneath it.

This patch lets an exact configured task keep its completed reasoning open by default. The stock
collapse control remains available: automatic closure is prevented, but a human can still fold the
section manually.

## Configuration

Reasoning retention is an exact-task extension of the
[task visual palette](../task-visual-palette/) identity rule. Set `keepReasoningOpen: true` beside a
rule's exact `taskId` in `<workspaceRoot>/.codex/task-visual-palette.json`. Title-only rules cannot
enable it.

```json
{
  "rules": {
    "^(Engine Tender — Repairs|22222222-2222-4222-8222-222222222222)$": {
      "color": "#71879A",
      "taskId": "22222222-2222-4222-8222-222222222222",
      "keepReasoningOpen": true
    }
  }
}
```

The palette is the one identity registry; this patch does not create a second roster or duplicate
its selectors. It requires the task-visual-palette patch in the selected fleet. When runtime JSON
reload is selected through that dependency, valid external palette saves update the exact-ID
reasoning decision without restarting Codex.

## Owned seam

The palette loader validates and publishes the exact-ID decision through a tiny renderer-local
subscription. The local turn renderer subscribes and adds that decision to the stock
`preventAutoCollapse` prop on the agent-activity component. The conversation thread also subscribes
and suppresses Codex's separate next-turn auto-collapse write for opted-in tasks. Human collapse
and reopen actions still use the stock persisted state.

The transform also verifies the upstream collapse contract: `preventAutoCollapse` affects the
default completed state, while an explicit persisted collapse still wins. It patches the automatic
write at its source rather than overriding all persisted state, so a human choice remains distinct
from Codex advancing to the next turn. If the task renderer, thread transition, palette bridge, or
collapse semantics move, application refuses.

## Check and apply

```sh
node bin/toolkit.mjs patch reasoning-retention check /path/to/extracted-asar
node bin/toolkit.mjs patch reasoning-retention apply /path/to/extracted-asar
node test/reasoning-retention.test.mjs /path/to/extracted-asar
```

## Verification

`test/reasoning-retention-transform.test.mjs` proves exact-task opt-in, ordinary-task stock behavior,
asynchronous policy subscription, the selected turn's expanded completion state, next-turn
retention, preserved manual collapse, module syntax, and byte-identical second application.

Live acceptance on build `8109` completed a real configured turn, sent the next message, and
confirmed that the prior reasoning stayed open while the chevron could close and reopen it.

## Non-goals

- exposing reasoning the model or provider did not emit;
- changing reasoning effort, summaries, compaction, or transcript persistence;
- forcing configured sections permanently open;
- matching by a mutable title alone;
- changing ordinary tasks.
