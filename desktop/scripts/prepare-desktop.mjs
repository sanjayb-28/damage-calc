import {execFileSync} from 'node:child_process';
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(desktopDir, '..');
const upstreamDist = path.join(rootDir, 'dist');
const desktopDist = path.join(desktopDir, 'dist');

const htmlFiles = [
  'index.html',
  'randoms.html',
  'oms.html',
  'champions.html',
  'honkalculate.html',
];

const requiredMarkers = {
  'index.html': ['set-selector', 'move-selector', 'class="field"'],
  'randoms.html': ['set-selector', 'move-selector', 'class="field"'],
  'oms.html': ['set-selector', 'move-selector', 'class="field"'],
  'champions.html': ['set-selector', 'move-selector', 'class="field"'],
  'honkalculate.html': ['set-selector', 'move-selector', 'id="holder-0"', 'id="holder-2"'],
};

const allowedRemoteAssets = new Set([
  'data.pkmn.cc',
  'maxcdn.bootstrapcdn.com',
  'cdn.datatables.net',
]);

// Upstream still references this retired dataset, but the authoritative
// randbats repository no longer publishes it. It is optional legacy data, so
// omit its script instead of making every desktop build depend on a 404.
const retiredRemoteScripts = new Set([
  'https://data.pkmn.cc/randbats/js/gen8randomdoublesbattle.js',
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUpstream() {
  if (process.env.PKMN_DESKTOP_SKIP_UPSTREAM_BUILD === '1') return;
  execFileSync('npm', ['run', 'build'], {cwd: rootDir, stdio: 'inherit'});
}

function desktopHeader() {
  return `<header class="desktop-app-header">
    <div class="desktop-brand">
      <img src="./desktop/assets/app-icon.webp" alt="" width="30" height="30" />
      <span>Pokémon Damage Calculator</span>
    </div>
    <div class="desktop-header-actions">
      <button class="desktop-theme-button" type="button" aria-label="Switch to light mode">
        <svg class="desktop-theme-icon desktop-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5"></circle>
          <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56"></path>
        </svg>
        <svg class="desktop-theme-icon desktop-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"></path>
        </svg>
        <span class="desktop-theme-label">Light mode</span>
      </button>
      <button class="desktop-update-button" type="button">Check for updates</button>
    </div>
  </header>`;
}

async function vendorRemoteAsset(rawUrl) {
  const url = new URL(rawUrl);
  if (!allowedRemoteAssets.has(url.hostname)) return rawUrl;

  const basename = path.basename(url.pathname) || 'asset';
  const relativePath = path.posix.join('desktop', 'vendor', url.hostname, basename);
  const outputPath = path.join(desktopDist, relativePath);

  await mkdir(path.dirname(outputPath), {recursive: true});
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to vendor ${url}: ${response.status} ${response.statusText}`);
  }
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  return `./${relativePath}`;
}

async function transformHtml(file) {
  const filePath = path.join(desktopDist, file);
  let html = await readFile(filePath, 'utf8');

  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>Pokémon Damage Calculator</title>')
    .replace(/<!-- Global site tag[\s\S]*?(?=\s*<!-- Immediately loads)/i, '')
    .replace(/<header>[\s\S]*?<\/header>/i, desktopHeader())
    .replace(/<div class="credits">[\s\S]*?<\/div>\s*(?=<\/body>)/i, '')
    .replace(/<body class="([^"]*)">/i, '<body class="$1 desktop-app">')
    .replace(
      '</head>',
      '    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'self\' https://github.com; font-src \'self\' data:; object-src \'none\'; base-uri \'none\'; form-action \'self\'">\n' +
      '    <script>window.gtag = function () {};</script>\n' +
      '    <script>(function () { var saved; try { saved = localStorage.getItem("desktopTheme"); } catch (_) {} var theme = saved === "light" || saved === "dark" ? saved : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); document.documentElement.dataset.desktopTheme = theme; var darkTheme = document.getElementById("dark-theme-styles"); if (darkTheme) darkTheme.disabled = theme === "light"; }());</script>\n' +
      '    <link rel="stylesheet" href="./desktop/desktop.css">\n</head>'
    )
    .replace('</body>', '    <script src="./desktop/desktop.js"></script>\n</body>');

  for (const remoteUrl of retiredRemoteScripts) {
    const escapedUrl = escapeRegExp(remoteUrl);
    html = html.replace(
      new RegExp(`<script\\b[^>]*\\bsrc=["']${escapedUrl}(?:\\?[^"']*)?["'][^>]*>\\s*</script>`, 'gi'),
      '',
    );
  }

  const remoteUrls = new Set();
  for (const match of html.matchAll(/(?:src=["']|url\()(?<url>https:\/\/[^"')?]+(?:\?[^"')]+)?)/g)) {
    remoteUrls.add(match.groups.url);
  }

  for (const remoteUrl of remoteUrls) {
    const localUrl = await vendorRemoteAsset(remoteUrl);
    if (localUrl !== remoteUrl) html = html.replaceAll(remoteUrl, localUrl);
  }

  const desktopMarkers = [
    'desktop-app-header',
    'desktop-theme-button',
    'desktop/desktop.css',
    'desktop/desktop.js',
    'window.gtag = function () {}',
    'desktopTheme',
    'desktop-app',
    ...requiredMarkers[file],
  ];
  for (const marker of desktopMarkers) {
    if (!html.includes(marker)) {
      throw new Error(`${file} is missing required desktop integration marker: ${marker}`);
    }
  }

  await writeFile(filePath, html);
}

async function main() {
  buildUpstream();
  await rm(desktopDist, {recursive: true, force: true});
  await cp(upstreamDist, desktopDist, {recursive: true});

  await rm(path.join(desktopDist, 'calc', 'test'), {recursive: true, force: true});

  const desktopAssetDir = path.join(desktopDist, 'desktop');
  await mkdir(path.join(desktopAssetDir, 'assets'), {recursive: true});
  await cp(path.join(desktopDir, 'theme', 'desktop.css'), path.join(desktopAssetDir, 'desktop.css'));
  await cp(path.join(desktopDir, 'runtime', 'desktop.js'), path.join(desktopAssetDir, 'desktop.js'));
  await cp(path.join(desktopDir, 'assets', 'app-icon.webp'), path.join(desktopAssetDir, 'assets', 'app-icon.webp'));

  await Promise.all(htmlFiles.map(transformHtml));
  console.log(`Prepared desktop assets in ${desktopDist}`);
}

await main();
