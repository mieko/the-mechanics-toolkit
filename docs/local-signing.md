# Stable local signing

Ad-hoc signing gives each changed application a designated requirement tied to that exact build.
macOS therefore treats each newly patched build as a different requester when it accesses an
existing Keychain item or another permission remembered by code identity.

A persistent local code-signing identity gives successive patched builds the same designated
requirement: the `com.openai.codex` signing identifier plus the local certificate. That can preserve
permissions whose policy is based on the designated requirement. It is not a universal Keychain
workaround: Codex's current Storage Key also has a separate `partition_id` policy containing exact
code hashes, so that item may still prompt after a changed build.

Create a private self-signed **Code Signing** identity in the local Keychain using Keychain Access's
Certificate Assistant, then confirm its exact name with:

```sh
security find-identity -v -p codesigning
```

Put that name in the ignored configuration:

```json
{
  "signingIdentity": "Your Local Codex Signing Identity"
}
```

The setting is optional. Omitting it or using `"-"` preserves the zero-setup ad-hoc behavior.

## Trust boundary

This does not make the patched application OpenAI-signed or restore OpenAI's Team ID. It establishes
a private identity trusted only where its certificate is deliberately installed. Each machine or
ship should create its own identity; never publish or exchange the private key. The existing native
app-tools peer-authorization repair remains necessary because a local identity still lacks the
vendor Team ID.

Anyone holding the private key could sign another `com.openai.codex` bundle that satisfies the same
local designated requirement. Keep the key non-exportable when practical and protected by the
login Keychain. To retire the identity, return `signingIdentity` to `"-"`, stage a fresh candidate,
and remove the certificate and private key from Keychain Access after replacing any applications
that depend on it.
