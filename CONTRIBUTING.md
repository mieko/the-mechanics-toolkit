# Contributing

A useful contribution makes one exact Codex Desktop seam easier to inspect, repair, or retire.
Please open an issue before investing in a broad redesign; minified ownership moves quickly, and a
small current transform is usually better than a compatibility framework.

Contributions must remain source-only. Do not submit application bundles, ASAR archives, extracted
vendor code, credentials, profiles, task databases, conversations, crash dumps, personal paths,
real task IDs, or private configuration. Screenshots must be deliberately reviewed and redacted.

A patch should include:

- one directory under `patches/` with a maintenance README;
- an exact fail-closed transform and a focused causal probe;
- the Codex Desktop version/build actually inspected;
- byte-identical second-application proof; and
- a clear statement of what remains unverified, especially live application behavior.

Run `npm install` once, then `npm run check && npm test` before submitting. Do not weaken a matcher
merely to make a newer build pass; a changed owner is evidence to inspect.
