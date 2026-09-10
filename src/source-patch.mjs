import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

export function sourcePatchState({definition, checkoutRoot, repositoryRoot}) {
  const checkout = path.resolve(checkoutRoot);
  const topLevel = git(checkout, ["rev-parse", "--show-toplevel"]);
  if (fs.realpathSync(topLevel) !== fs.realpathSync(checkout)) {
    throw new Error(`Codex checkout must name its Git root: ${topLevel}`);
  }

  const head = git(checkout, ["rev-parse", "HEAD"]);
  if (head !== definition.commit) {
    throw new Error(
      `${definition.name} requires ${definition.tag} at ${definition.commit}; checkout is ${head}`
    );
  }

  const observed = Object.fromEntries(Object.keys(definition.files).map(file => {
    const target = path.join(checkout, file);
    if (!fs.statSync(target, {throwIfNoEntry: false})?.isFile()) {
      throw new Error(`Missing source-patch target: ${file}`);
    }
    return [file, sha256(target)];
  }));
  const allBefore = Object.entries(definition.files).every(([file, hashes]) => observed[file] === hashes.before);
  const allAfter = Object.entries(definition.files).every(([file, hashes]) => observed[file] === hashes.after);
  const state = allBefore ? "needs-apply" : allAfter ? "applied" : "incompatible";

  return {
    patch: definition.name,
    state,
    checkout,
    upstream: definition.upstream,
    tag: definition.tag,
    commit: definition.commit,
    desktop: definition.desktop,
    patchFile: path.resolve(repositoryRoot, definition.patch),
    files: observed
  };
}

export function applySourcePatch({definition, checkoutRoot, repositoryRoot}) {
  let result = sourcePatchState({definition, checkoutRoot, repositoryRoot});
  if (result.state === "applied") return result;
  if (result.state !== "needs-apply") {
    throw new Error(`${definition.name} source targets do not match either the qualified before or after state`);
  }

  const checked = spawnSync("git", ["-C", result.checkout, "apply", "--check", result.patchFile], {
    encoding: "utf8"
  });
  if (checked.status !== 0) throw new Error(`git apply --check failed: ${(checked.stderr || checked.stdout).trim()}`);
  const applied = spawnSync("git", ["-C", result.checkout, "apply", result.patchFile], {encoding: "utf8"});
  if (applied.status !== 0) throw new Error(`git apply failed: ${(applied.stderr || applied.stdout).trim()}`);

  result = sourcePatchState({definition, checkoutRoot, repositoryRoot});
  if (result.state !== "applied") throw new Error(`${definition.name} did not reach its qualified after state`);
  return result;
}

function git(checkout, args) {
  const result = spawnSync("git", ["-C", checkout, ...args], {encoding: "utf8"});
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function sha256(target) {
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}
