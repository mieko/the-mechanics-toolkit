import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {sha256File} from "./app-bundle.mjs";
import {patchDefinition, patchDefinitions} from "./patch-catalog.mjs";

const baseConfigKeys = Object.freeze([
  "codexBinary",
  "enabledPatches",
  "signingIdentity",
  "workspaceRoot",
  "tinrelay"
]);

export function readToolkitConfig(file, {platformKeys = []} = {}) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read toolkit config: ${error.message}`);
  }
  if (config == null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Toolkit config must be a JSON object");
  }
  const allowed = new Set([...baseConfigKeys, ...platformKeys]);
  const unknown = Object.keys(config).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`Unknown toolkit config keys: ${unknown.join(", ")}`);
  return config;
}

export function selectedPatches(names) {
  if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== "string")) {
    throw new Error("Toolkit config enabledPatches must be a nonempty array of patch names");
  }
  if (new Set(names).size !== names.length) {
    throw new Error("Toolkit config enabledPatches contains duplicates");
  }
  const unknown = names.filter(name => patchDefinition(name) == null);
  if (unknown.length > 0) throw new Error(`Unknown enabled patches: ${unknown.join(", ")}`);
  const selected = patchDefinitions.filter(definition => names.includes(definition.name));
  for (const infrastructure of ["renderer-patch-registry", "safe-start-readiness"]) {
    if (!names.includes(infrastructure)) {
      throw new Error(`Staged patch fleets must include ${infrastructure}`);
    }
  }
  for (const definition of selected) {
    const missing = definition.requires.filter(name => !names.includes(name));
    if (missing.length > 0) throw new Error(`${definition.name} requires: ${missing.join(", ")}`);
  }
  return selected;
}

export function applyPatchFleet({
  selected,
  roots,
  configFile,
  config,
  repository,
  sourceLabel = "Source application"
}) {
  requirePatchRoots(selected, roots);
  const initialChecks = checkPatches(selected, roots, configFile, repository);
  const unexpected = initialChecks.filter(result => result.output.state !== "needs-apply");
  if (unexpected.length > 0) {
    const states = unexpected.map(result => `${result.name}=${result.output.state}`).join(", ");
    throw new Error(`${sourceLabel} is not pristine for selected patches: ${states}`);
  }

  const applied = applyPatches(selected, roots, configFile, repository);
  const targets = changedTargets(applied);
  syntaxCheckTargets(roots.asar, asarTargets(applied));
  runProbes(selected, roots, config, repository);
  const firstAsarTree = selected.some(definition => definition.scope === "asar")
    ? treeSnapshot(roots.asar)
    : null;
  const firstAppTargets = patchTargetSnapshot(applied.filter(result => result.scope === "app"));
  const secondApplied = applyPatches(selected, roots, configFile, repository);
  if (firstAsarTree != null && !equalRecords(firstAsarTree, treeSnapshot(roots.asar))) {
    throw new Error("Second patch application changed the extracted ASAR tree");
  }
  if (!equalRecords(
    firstAppTargets,
    patchTargetSnapshot(secondApplied.filter(result => result.scope === "app"))
  )) {
    throw new Error("Second patch application changed staged application metadata");
  }
  return {applied, changedTargets: targets};
}

export function verifyPatchFleet({selected, roots, configFile, config, repository}) {
  requirePatchRoots(selected, roots);
  const checks = checkPatches(selected, roots, configFile, repository);
  if (!checks.every(result => result.output.state === "applied")) {
    throw new Error("Final staged application does not satisfy every selected patch");
  }
  syntaxCheckTargets(roots.asar, asarTargets(checks));
  runProbes(selected, roots, config, repository);
  return checks;
}

export function treeSnapshot(root) {
  const snapshot = {};
  walk(root, file => {
    const relative = path.relative(root, file);
    const stat = fs.lstatSync(file);
    snapshot[relative] = stat.isSymbolicLink()
      ? {type: "symlink", target: fs.readlinkSync(file)}
      : {type: "file", sha256: sha256File(file), mode: stat.mode & 0o777};
  });
  return snapshot;
}

export function equalRecords(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function recordDifferences(left, right) {
  const names = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const changed = names.filter(name => JSON.stringify(left[name]) !== JSON.stringify(right[name]));
  return changed.slice(0, 8)
    .map(name => `${name} (${JSON.stringify(left[name])} -> ${JSON.stringify(right[name])})`)
    .join(", ") + (changed.length > 8 ? `, plus ${changed.length - 8} more` : "");
}

function requirePatchRoots(selected, roots) {
  for (const scope of new Set(selected.map(definition => definition.scope))) {
    if (typeof roots?.[scope] !== "string" || roots[scope] === "") {
      throw new Error(`Staging has no root for ${scope}-scope patches`);
    }
  }
}

function checkPatches(selected, roots, configFile, repository) {
  return selected.map(definition => ({
    name: definition.name,
    scope: definition.scope,
    root: roots[definition.scope],
    output: patchCommand(definition, "check", roots[definition.scope], configFile, repository)
  }));
}

function applyPatches(selected, roots, configFile, repository) {
  return selected.map(definition => {
    const root = roots[definition.scope];
    const output = patchCommand(definition, "apply", root, configFile, repository);
    if (output.state !== "applied") throw new Error(`${definition.name} apply returned ${output.state}`);
    return {name: definition.name, scope: definition.scope, root, output};
  });
}

function patchCommand(definition, action, root, configFile, repository) {
  const args = [path.join(repository, definition.script), action, root];
  if (definition.config) args.push("--config", configFile);
  return jsonCommand(process.execPath, args, `${definition.name} ${action}`);
}

function runProbes(selected, roots, config, repository) {
  for (const definition of selected) {
    const args = [path.join(repository, definition.probe), roots[definition.scope]];
    if (definition.probeWorkspaceRoot) args.push(path.resolve(config.workspaceRoot));
    run(process.execPath, args);
  }
}

function changedTargets(results) {
  const targets = [];
  for (const {output} of results) {
    if (typeof output.target === "string") targets.push(output.target);
    if (Array.isArray(output.targets)) targets.push(...output.targets);
  }
  return [...new Set(targets)].sort();
}

function asarTargets(results) {
  return changedTargets(results.filter(result => result.scope === "asar"));
}

function patchTargetSnapshot(results) {
  const snapshot = {};
  for (const result of results) {
    const targets = typeof result.output.target === "string"
      ? [result.output.target]
      : result.output.targets ?? [];
    if (targets.length === 0) {
      throw new Error(`${result.name} app patch did not report a changed target`);
    }
    for (const target of targets) {
      const file = path.join(result.root, target);
      requireFile(file, `${result.name} changed target ${target}`);
      const stat = fs.statSync(file);
      snapshot[`${result.name}:${target}`] = {sha256: sha256File(file), mode: stat.mode & 0o777};
    }
  }
  return snapshot;
}

function syntaxCheckTargets(extracted, targets) {
  for (const target of targets.filter(target => target.endsWith(".js"))) {
    const file = path.join(extracted, target);
    requireFile(file, `changed module ${target}`);
    const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
      encoding: "utf8",
      input: fs.readFileSync(file),
      maxBuffer: 64 * 1024 * 1024
    });
    if (result.status !== 0) {
      const output = result.stderr || result.stdout;
      const summary = output.match(/SyntaxError:[^\n]*/)?.[0] ?? output.trim().slice(-1000);
      throw new Error(`module syntax check failed for ${target}: ${summary}`);
    }
  }
}

function jsonCommand(program, args, label) {
  const result = run(program, args);
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function run(program, args) {
  const result = spawnSync(program, args, {encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  if (result.status !== 0) {
    const cause = result.error?.message ?? (result.stderr || result.stdout).trim();
    throw new Error(`${path.basename(program)} ${args.join(" ")} failed: ${cause}`);
  }
  return result;
}

function requireFile(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

function walk(directory, visit) {
  const entries = fs.readdirSync(directory, {withFileTypes: true})
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, visit);
    else visit(target);
  }
}
