import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedVersion = process.argv[2]?.trim();
const versionPattern = /^\d+\.\d+\.\d+$/;

function parseVersion(value) {
  const normalized = String(value || '').replace(/^desktop-v/, '');
  if (!versionPattern.test(normalized)) return null;
  return normalized.split('.').map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

if (requestedVersion) {
  if (!versionPattern.test(requestedVersion)) {
    throw new Error(`Invalid release version: ${requestedVersion}`);
  }
  console.log(requestedVersion);
} else {
  const tauriConfig = JSON.parse(
    await readFile(path.join(desktopDir, 'src-tauri', 'tauri.conf.json'), 'utf8'),
  );
  const versions = [tauriConfig.version, ...process.argv.slice(3)]
    .map(parseVersion)
    .filter(Boolean)
    .sort(compareVersions);
  const latest = versions.at(-1);
  if (!latest) throw new Error('Unable to determine the next desktop version');
  console.log(`${latest[0]}.${latest[1]}.${latest[2] + 1}`);
}
