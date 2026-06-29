import {readFile} from 'node:fs/promises';

const [feedPath, expectedVersion] = process.argv.slice(2);
if (!feedPath || !expectedVersion) {
  throw new Error('Usage: node verify-update-feed.mjs <latest.json> <expected-version>');
}

const feed = JSON.parse(await readFile(feedPath, 'utf8'));
if (feed.version !== expectedVersion) {
  throw new Error(`Updater feed version ${feed.version} does not match ${expectedVersion}`);
}

const platforms = feed.platforms || {};
const macPlatform = platforms['darwin-universal'] || platforms['darwin-aarch64'] || platforms['darwin-x86_64'];
if (!macPlatform?.url || !macPlatform?.signature) {
  throw new Error('Updater feed is missing a signed macOS artifact');
}
if (!macPlatform.url.startsWith('https://github.com/sanjayb-28/damage-calc/releases/download/')) {
  throw new Error(`Unexpected updater artifact URL: ${macPlatform.url}`);
}

console.log(`Updater feed valid for desktop version ${expectedVersion}`);
