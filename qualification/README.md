# Maintainer platform qualification

These runbooks are for toolkit maintainers and agents actively porting or validating TMTK with
explicit authority to replace the canonical installed application. They are not part of ordinary
installation. Some capability phases deliberately install a broken application and require a
technical operator, a verified restoration source, and a witnessed recovery seam.

An agent adopting an already-qualified patchset should read its receipt, stage from the matching
pristine vendor build, perform the healthy restart and selected-feature acceptance checks, and stop
there. It should not manufacture blank or Oops failures for its user. Only a maintainer qualifying a
changed supervisor boundary runs those destructive capability phases.

Desktop qualification is platform-specific. Generated JavaScript may share substantial structure,
but packaging, signing, process discovery, application shutdown, terminal rescue, storage, and
native-module behavior do not. A platform is qualified only by its own runbook and receipt.

- [macOS](macos.md) — implemented
- Windows — not yet implemented or qualified
- Linux — not yet implemented or qualified

Transform recognition on another package is portability evidence, not platform qualification.
