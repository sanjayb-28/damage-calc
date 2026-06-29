import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(desktopDir, '..');

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

const packageJson = JSON.parse(await read('desktop/package.json'));
const packageLock = JSON.parse(await read('desktop/package-lock.json'));
const tauriConfig = JSON.parse(await read('desktop/src-tauri/tauri.conf.json'));
const releaseConfig = JSON.parse(await read('desktop/src-tauri/tauri.release.conf.json'));
const cargoToml = await read('desktop/src-tauri/Cargo.toml');
const runtime = await read('desktop/runtime/desktop.js');
const desktopIgnore = await read('desktop/.gitignore');
const releaseWorkflow = await read('.github/workflows/desktop-release.yml');
const cargoVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1];

const versions = [
  packageJson.version,
  packageLock.version,
  packageLock.packages?.['']?.version,
  tauriConfig.version,
  cargoVersion,
];
invariant(versions.every((version) => version === versions[0]), `Desktop versions differ: ${versions.join(', ')}`);
invariant(releaseConfig.bundle?.createUpdaterArtifacts === true, 'Release builds must create updater artifacts');
invariant(typeof tauriConfig.plugins?.updater?.pubkey === 'string', 'Updater public key is missing');
invariant(tauriConfig.plugins.updater.pubkey.length > 80, 'Updater public key is invalid');
invariant(
  tauriConfig.plugins.updater.endpoints?.includes(
    'https://github.com/sanjayb-28/damage-calc/releases/latest/download/latest.json',
  ),
  'Updater endpoint does not target this repository',
);
invariant(desktopIgnore.split(/\r?\n/).includes('.keys/'), 'desktop/.keys must remain ignored');
invariant(/setInterval\(checkForUpdate/.test(runtime), 'The app must periodically check for updates');
invariant(/tauri-apps\/tauri-action@v1/.test(releaseWorkflow), 'Release workflow must use tauri-action v1');
invariant(/uploadUpdaterJson: true/.test(releaseWorkflow), 'Release workflow must upload latest.json');

const trackedKeys = execFileSync('git', ['ls-files', 'desktop/.keys'], {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();
invariant(!trackedKeys, 'Private updater keys must never be tracked');

console.log(`Release configuration valid for desktop version ${versions[0]}`);
