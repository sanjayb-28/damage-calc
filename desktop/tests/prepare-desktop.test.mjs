import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);

test('desktop build is isolated and branded', async () => {
  const html = await readFile(path.join(desktopDir, 'dist', 'index.html'), 'utf8');
  assert.match(html, /Pokémon Damage Calculator/);
  assert.match(html, /desktop\/desktop\.css/);
  assert.match(html, /desktop\/desktop\.js/);
  assert.doesNotMatch(html, /googletagmanager|gtag\(/);
  assert.doesNotMatch(html, /pokemonshowdownbeta/);
});

test('desktop build vendors runtime scripts', async () => {
  const randoms = await readFile(path.join(desktopDir, 'dist', 'randoms.html'), 'utf8');
  const honkalculate = await readFile(path.join(desktopDir, 'dist', 'honkalculate.html'), 'utf8');
  assert.doesNotMatch(randoms, /src="https:\/\/data\.pkmn\.cc/);
  assert.doesNotMatch(honkalculate, /(?:src|url\()=?["']?https:\/\/(?:maxcdn\.bootstrapcdn|cdn\.datatables)/);
});

test('desktop background is procedural and move colors are live', async () => {
  const css = await readFile(path.join(desktopDir, 'dist', 'desktop', 'desktop.css'), 'utf8');
  const runtime = await readFile(path.join(desktopDir, 'dist', 'desktop', 'desktop.js'), 'utf8');
  assert.match(runtime, /desktop-motion-field/);
  assert.match(runtime, /requestAnimationFrame\(syncMoveTypes\)/);
  assert.match(runtime, /change\.desktopMoveColor/);
  assert.match(runtime, /installDesktopMoveSelectors/);
  assert.match(runtime, /Search moves/);
  assert.match(runtime, /closeDetachedSelect2/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.doesNotMatch(css, /motion-field\.png/);
});

test('automatic release versions increase monotonically', async () => {
  const {stdout} = await execFileAsync(
    process.execPath,
    [path.join(desktopDir, 'scripts', 'next-version.mjs'), '', 'desktop-v0.1.8', 'desktop-v0.2.3'],
    {cwd: desktopDir},
  );
  assert.equal(stdout.trim(), '0.2.4');
});
