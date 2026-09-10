# Contributing

A useful contribution makes one exact Codex Desktop package seam or open-source Codex App
Server/Core seam easier to inspect, repair, or retire.
Please open an issue before investing in a broad redesign; minified ownership moves quickly, and a
small current transform is usually better than a compatibility framework.

Contributions must remain source-only. Do not submit application bundles, ASAR archives, copied
upstream trees, compiled binaries, credentials, profiles, task databases, conversations, crash
dumps, personal paths, real task IDs, or private configuration. Screenshots must be deliberately
reviewed and redacted.

A desktop package patch should include:

- one directory under `patches/` with a maintenance README;
- an exact fail-closed transform and a focused causal probe;
- the Codex Desktop version/build actually inspected;
- byte-identical second-application proof; and
- a clear statement of what remains unverified, especially live application behavior.

An App Server/Core source patch instead belongs under `source-patches/` and should include the exact
upstream tag and commit, an inspectable diff, qualified before/after target hashes, focused upstream
tests, the build command, and the boundary by which a built executable enters desktop staging.

Run `npm install` once, then `npm run check && npm test` before submitting. Do not weaken a matcher
merely to make a newer build pass; a changed owner is evidence to inspect.
