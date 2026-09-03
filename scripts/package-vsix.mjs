#!/usr/bin/env node
import { execSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));

function run(command, cwd = root) {
  execSync(command, { cwd, stdio: "inherit" });
}

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
run("pnpm build");

const staging = await mkdtemp(join(tmpdir(), "pi-gui-vsix-"));
try {
  const stagedPkg = structuredClone(pkg);
  delete stagedPkg.scripts["vscode:prepublish"];
  stagedPkg.scripts = { ...stagedPkg.scripts, package: "vsce package" };
  await writeFile(join(staging, "package.json"), `${JSON.stringify(stagedPkg, null, 2)}\n`);
  await writeFile(
    join(staging, ".vscodeignore"),
    ["**/*.map", "src/**", "scripts/**", "specs/**", "*.ts", "*.tsx"].join("\n"),
  );
  await cp(join(root, "README.md"), join(staging, "README.md"));
  await mkdir(join(staging, "media"), { recursive: true });
  await mkdir(join(staging, "dist"), { recursive: true });
  await mkdir(join(staging, "out"), { recursive: true });
  await cp(join(root, "media"), join(staging, "media"), { recursive: true });
  await cp(join(root, "dist"), join(staging, "dist"), { recursive: true });
  await cp(join(root, "out"), join(staging, "out"), { recursive: true });
  run("npm install --omit=dev --ignore-scripts", staging);
  run("npx --yes @vscode/vsce package --allow-missing-repository", staging);
  const vsixName = `${pkg.name}-${pkg.version}.vsix`;
  await cp(join(staging, vsixName), join(root, vsixName));
  console.log(`Wrote ${vsixName}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
