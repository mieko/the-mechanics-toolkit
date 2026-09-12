import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { asarHeaderSha256, readAsarFile } from "./asar-integrity.mjs";

const bundleIdentifier = "com.openai.codex";

export function inspectAppBundle(app, {
  verifySignature = true,
  platform = process.platform
} = {}) {
  if (platform === "linux") return inspectLinuxApplication(app);
  if (platform !== "darwin") {
    throw new Error(`Codex application inspection is not yet qualified for ${platform}`);
  }
  return inspectMacosAppBundle(app, {verifySignature});
}

function inspectMacosAppBundle(app, {verifySignature}) {
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
      sha256: sha256File(archive)
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

function inspectLinuxApplication(app) {
  const resolvedApp = path.resolve(app);
  requireDirectory(resolvedApp, "application directory");

  const executable = path.join(resolvedApp, "ChatGPT");
  const archive = path.join(resolvedApp, "resources/app.asar");
  const cli = path.join(resolvedApp, "resources/codex");
  const metadataFile = path.join(resolvedApp, "resources/linux-package-metadata.json");
  requireExecutable(executable, "ChatGPT executable");
  requireFile(archive, "app.asar");
  requireExecutable(cli, "bundled Codex CLI");
  requireFile(metadataFile, "Linux package metadata");

  const metadata = readJson(metadataFile, "Linux package metadata");
  const application = readJsonBuffer(readAsarFile(archive, "package.json"), "ASAR package.json");
  if (metadata.codexAppBrand !== "chatgpt" || metadata.codexBuildFlavor !== "prod") {
    throw new Error("Refusing non-production ChatGPT Linux application");
  }
  if (application.name !== "openai-codex-electron" || application.desktopName !== "chatgpt.desktop") {
    throw new Error("Refusing non-Codex Linux application archive");
  }
  if (typeof metadata.version !== "string" || metadata.version === "" ||
      application.version !== metadata.version) {
    throw new Error("Linux package and inner application versions disagree");
  }
  if (!/^\d+$/.test(String(application.codexBuildNumber))) {
    throw new Error("Linux application has an invalid Codex build number");
  }

  return {
    app: resolvedApp,
    identifier: "chatgpt",
    version: application.version,
    build: String(application.codexBuildNumber),
    archive: {
      path: archive,
      sha256: sha256File(archive),
      headerSha256: asarHeaderSha256(archive)
    },
    executable: {path: executable, sha256: sha256File(executable)},
    cli: {path: cli, sha256: sha256File(cli)},
    asarIntegrity: {
      state: "not-applicable",
      detail: "Electron does not embed an ASAR integrity seal on Linux"
    },
    signature: {
      state: "not-applicable",
      detail: "Linux trust is carried by the installed distribution package"
    },
    package: {
      format: "deb",
      name: "chatgpt",
      version: metadata.version,
      state: "directory-inspection"
    }
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

export function sha256File(file) {
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

function requireExecutable(target, label) {
  requireFile(target, label);
  try {
    fs.accessSync(target, fs.constants.X_OK);
  } catch {
    throw new Error(`Non-executable ${label}: ${target}`);
  }
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label}: ${error.message}`);
  }
}

function readJsonBuffer(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label}: ${error.message}`);
  }
}

function firstLine(value) {
  return value.trim().split("\n", 1)[0].slice(0, 500);
}
