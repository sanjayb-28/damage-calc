import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  throw new Error("Usage: npm run version:set -- <semver>");
}

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const relativePath of ["package.json", "package-lock.json"]) {
  const filePath = path.join(desktopRoot, relativePath);
  const document = JSON.parse(await readFile(filePath, "utf8"));
  document.version = version;
  if (document.packages?.[""]) document.packages[""].version = version;
  await writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

const tauriConfigPath = path.join(desktopRoot, "src-tauri", "tauri.conf.json");
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
tauriConfig.version = version;
await writeFile(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);

const cargoPath = path.join(desktopRoot, "src-tauri", "Cargo.toml");
const cargoToml = await readFile(cargoPath, "utf8");
await writeFile(
  cargoPath,
  cargoToml.replace(/(^\[package\][\s\S]*?^version = ")[^"]+("$)/m, `$1${version}$2`),
);

console.log(`Desktop version set to ${version}`);
