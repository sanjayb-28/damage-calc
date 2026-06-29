# PKMN DMG Calc desktop

This directory is an isolated Tauri wrapper around the upstream static calculator. The upstream source remains unchanged: `scripts/prepare-desktop.mjs` builds it, copies `dist`, removes web-only material, vendors runtime assets, and injects the desktop theme and bridge.

## Local development

Requirements: Node.js, npm, Rust, and the standard macOS developer command-line tools.

```sh
cd desktop
npm ci
npm run test
npm run dev
```

Build the installable app and DMG with:

```sh
cd desktop
npm run build
```

Artifacts are written under `desktop/src-tauri/target/release/bundle/`.

## Upstream updates

The `Sync upstream and release` workflow checks `smogon/damage-calc` every three days. When upstream has changed, it:

1. merges `upstream/master` into this fork's `master` branch;
2. installs dependencies and runs the calculator and desktop-overlay tests;
3. pushes the merge only after those tests pass; and
4. dispatches the desktop release workflow.

If the merge conflicts, the workflow stops and opens one GitHub issue instead of overwriting desktop changes. A manual update still uses the normal Git flow:

```sh
git fetch upstream master
git merge upstream/master
npm ci
npm test
cd desktop
npm ci
npm run prepare:desktop
npm run test
npm run release:check
```

Desktop-specific code stays under this directory, so upstream conflicts should be limited to the build transform if upstream changes its HTML structure.

## CI/CD and automatic updates

The app checks the GitHub updater feed at launch, every six hours while open, and when it becomes active after at least 15 minutes. When a signed update is available, the header shows an update button; installation is handled by Tauri and the app restarts into the new version.

`Desktop CI` validates calculator builds, the overlay transform, release configuration, automatic version calculation, and Rust formatting on relevant pull requests. `Desktop release` then:

- chooses the next patch version from the latest `desktop-v*` tag unless a manual version is supplied;
- keeps npm, Cargo, and Tauri versions synchronized;
- builds a universal Intel/Apple Silicon macOS app and DMG;
- ad-hoc signs the app and cryptographically signs the Tauri updater bundle;
- publishes a GitHub Release, updater signatures, and `latest.json`;
- verifies the published updater feed; and
- attaches a versioned Homebrew cask with the correct DMG checksum.

No Apple Developer membership is required. Because the app is not Apple-notarized, the Homebrew cask removes only the installed app's quarantine attribute.

Install the current release from the dedicated tap:

```sh
brew install --cask sanjayb-28/pkmn-dmg-calc/pkmn-dmg-calc
```

The tap uses a stable latest-release DMG. After installation, the app's signed in-app updater handles new versions automatically.

### One-time repository setup

1. Back up `desktop/.keys/updater.key` securely. Losing it prevents existing installs from accepting future updates.
2. Add its complete contents as the repository secret `TAURI_SIGNING_PRIVATE_KEY`. If the key has a password, add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` too.
3. In GitHub Actions settings, allow workflows read/write access so the sync job can push and the release job can create releases.
4. Ensure scheduled workflows are enabled for the fork.
5. Run `Desktop release` once manually. Leave the version blank to calculate it automatically.

The updater private key is ignored by Git and validated as untracked by `npm run release:check`. Never add the key to the repository.

Automatic upstream publishing deliberately trusts `smogon/damage-calc` source changes. If that trust model is no longer acceptable, disable the schedule and review upstream sync pull requests before releasing.
