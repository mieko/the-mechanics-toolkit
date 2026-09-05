import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { asarHeaderSha256 } from "./asar-integrity.mjs";

const bundleIdentifier = "com.openai.codex";

export function inspectAppBundle(app, { verifySignature = true } = {}) {
  const resolvedApp = path.resolve(app);
  requireDirectory(resolvedApp, "application bundle");

  const info = path.join(resolvedApp, "Contents/Info.plist");
  const archive = path.join(resolvedApp, "Contents/Resources/app.asar");
  requireFile(info, "Info.plist");
  requireFile(archive, "app.asar");

  const identifier = plist(info, "Print :CFBundleIdentifier");
  if (identifier !== bundleIdentifier) {
    throw new Error(`Refusing non-Codex application bundle: ${identifier}`);
  }

  const algorithm = plist(info, "Print :ElectronAsarIntegrity:Resources/app.asar:algorithm");
  if (algorithm !== "SHA256") {
    throw new Error(`Unsupported ASAR integrity algorithm: ${algorithm}`);
  }

  const expectedHash = plist(info, "Print :ElectronAsarIntegrity:Resources/app.asar:hash");
  if (!/^[0-9a-f]{64}$/.test(expectedHash)) {
    throw new Error("ElectronAsarIntegrity contains an invalid SHA-256 value");
  }

  const actualHash = asarHeaderSha256(archive);
  return {
    app: resolvedApp,
    identifier,
    version: plist(info, "Print :CFBundleShortVersionString"),
    build: plist(info, "Print :CFBundleVersion"),
    archive: {
      path: archive,
      sha256: sha256(archive)
    },
    asarIntegrity: {
      state: expectedHash === actualHash ? "valid" : "mismatch",
      algorithm,
      expectedHash,
      actualHash
    },
    signature: verifySignature ? inspectSignature(resolvedApp) : { state: "not-checked" }
  };
}

function inspectSignature(app) {
  const result = spawnSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app], {
    encoding: "utf8"
  });
  return result.status === 0
    ? { state: "valid" }
    : { state: "invalid", detail: firstLine(result.stderr || result.stdout) };
}

function plist(info, command) {
  const result = spawnSync("/usr/libexec/PlistBuddy", ["-c", command, info], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Could not read ${command.replace(/^Print :/, "")} from Info.plist`);
  }
  return result.stdout.trim();
}

function sha256(file) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (let bytesRead; (bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0;) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function requireDirectory(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function requireFile(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function firstLine(value) {
  return value.trim().split("\n", 1)[0].slice(0, 500);
}
