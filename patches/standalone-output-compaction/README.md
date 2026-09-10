# Patched Codex binary integration

Installs an explicitly supplied, separately built `codex` executable into a staged Codex Desktop
candidate. This is the macOS package-integration half of the
[standalone-output compaction source repair](../../source-patches/standalone-output-compaction/);
it does not patch or build Rust source.

Set `codexBinary` in the private toolkit config to the absolute path of the built executable and
enable the catalog entry `standalone-output-compaction`. During the ordinary staging flow, this
transform:

1. requires both the vendor and replacement executables to start with `--version`;
2. refuses a replacement whose reported CLI version differs from the vendor bundle;
3. copies the replacement to `Contents/Resources/codex` in the staged candidate only;
4. preserves the executable mode and verifies the exact replacement SHA-256; and
5. lets the complete app staging pass sign and re-verify the candidate.

```json
{
  "enabledPatches": ["standalone-output-compaction"],
  "codexBinary": "/absolute/path/to/codex-rs/target/release/codex"
}
```

The input binary is not accepted merely because it has the right version string. Its source,
tests, build provenance, and fitness remain the operator agent's responsibility. The same-version
check prevents an obvious incompatible package, while the source patch's own README provides the
qualified source and verification procedure.

Rollback restores the untouched vendor application artifact. The toolkit never distributes the
built binary or modifies `/Applications` during staging.
