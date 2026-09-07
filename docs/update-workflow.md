# Preparing a patched Codex update

The preferred update has one interruption: obtain the offered vendor application, port and prove
the selected patch fleet while the user's current Codex remains available, then quit once and wake
directly into the patched new build. This is a goal, not a guarantee. If the offered build cannot be
obtained independently or the candidate does not pass every required check, stop and explain the
remaining interruption instead of installing an unproved application.

## Keep one live application identity

Do not install `ChatGPT.app` and `ChatGPT-MechanicsToolkit.app` side by side. Renaming an application
does not change its bundle identity. Both would still claim `com.openai.codex` and the `codex:`,
`http:`, and `https:` URL schemes, while their helpers, updater, application data, and single-instance
routing would also identify the same product. macOS and outside integrations could select a copy by
registration history or path rather than by the user's intent.

Changing the patched copy's bundle identifier is not a small fix. It would create a different
application identity and disturb data locations, Keychain and permission policy, helper and peer
requirements, protocol registration, updater behavior, and integrations that address Codex by its
existing identity.

Use these roles instead:

- **Vendor source:** the untouched, vendor-signed application from the official installer. Keep the
  installer or another non-live artifact as recovery evidence. Prefer a disk image or compressed
  archive over a loose `.app` backup so Spotlight and Launch Services do not discover another
  launchable copy.
- **Staged candidate:** an unlaunched application outside `/Applications`, conventionally named
  `ChatGPT-MechanicsToolkit.app`. The toolkit may modify and locally sign only this copy.
- **Live application:** the single adopted application at `/Applications/ChatGPT.app`, preserving
  the vendor bundle identifier and integration surface.

## Update-before-interruption sequence

1. Confirm which version and build Codex is offering.
2. Obtain the official macOS installer without installing or launching its application.
3. Verify the vendor signature, bundle identifier, architecture, version, and build. Stop if the
   artifact does not match the intended update.
4. Retain the vendor artifact untouched and use its application as the staging source.
5. Inspect upstream behavior, retire patches Codex now owns, and port only the repairs that still
   matter.
6. Stage the complete selected fleet as `ChatGPT-MechanicsToolkit.app` outside `/Applications` and
   require the toolkit's complete static proof.
7. Prepare a recoverable replacement and a short escape line before asking the user to quit. Keep
   recovery applications inside a disk image or compressed archive rather than as loose `.app`
   bundles. Do all work that can be completed in the current Codex first.
8. With explicit operator authority, quit the live app, adopt the candidate at the canonical
   `/Applications/ChatGPT.app` path, and relaunch it.
9. Exercise the narrow live checks for the selected fleet. Keep the recovery artifact until the
   new build is accepted.

Do not patch Sparkle's private download cache. An update being offered does not prove that a complete
installer or application is already present there, and Sparkle may replace, reject, or remove its
own working files. Obtain an ordinary vendor artifact and keep the toolkit's staging ownership
separate.

The toolkit intentionally has no installation command today. Static proof, operator authority,
application replacement, relaunch, and live acceptance remain distinct seams.
