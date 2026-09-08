# Building the installers

Installers are built by **GitHub Actions** (`.github/workflows/build.yml`) because
each platform needs its own native `ffmpeg` + `whisper-cli`, and macOS builds
whisper.cpp from source with Metal — which needs an actual Mac runner.

## What the workflow does

| Job | Runner | Output |
| --- | --- | --- |
| `check` | ubuntu | `npm run typecheck` gate |
| `build` (mac) | `macos-14` (Apple Silicon) | `dist/Auto Subtitles-<ver>-arm64.dmg` |
| `build` (win) | `windows-latest` | `dist/Auto Subtitles-<ver>-win-x64.exe` |
| `release` | ubuntu, tags only | GitHub Release with both files attached |

Each `build` leg runs `npm run fetch-binaries` (downloads arm64/x64 `ffmpeg`,
builds/downloads `whisper-cli`, downloads the caption fonts) and then asserts the
bundled `ffmpeg` has **libass** — without it the burn-in silently produces a
caption-less video.

## Running it

1. Push this repo to GitHub (see below if it isn't there yet).
2. **Manual run:** repo → **Actions** → *Build installers* → **Run workflow**.
   Download the `.dmg` from the run's **Artifacts** when it finishes (~10–15 min).
3. **Release run:** push a version tag and the `.dmg` + `.exe` are attached to a
   GitHub Release automatically:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## First launch on the Mac (unsigned build)

The app has **no Apple code-signing certificate**, so Gatekeeper will complain.

1. Move **Auto Subtitles.app** to `/Applications`.
2. First launch: **right-click the app → Open → Open** (only needed once).
3. If transcription or export fails with *"…cannot be opened because the
   developer cannot be verified"* (the nested `ffmpeg` / `whisper-cli`), clear the
   quarantine flag once:

   ```bash
   xattr -cr "/Applications/Auto Subtitles.app"
   ```

## Local builds (optional)

- On a Mac: `npm run fetch-binaries && npm run pack:mac`
- On Windows: `npm run fetch-binaries && npm run pack:win`
  (needs Windows Developer Mode enabled, or it fails on a symlink-privilege step)

## Icon

`build/icon.icns` (1024×1024) and `build/icon.ico` are picked up automatically by
electron-builder if present. There is none yet, so the build uses the default
Electron icon — drop the files in `build/` to brand it.

## Getting the repo onto GitHub

No `gh` CLI here, so create the repo in the browser
(<https://github.com/new>, empty, no README), then:

```bash
git remote add origin https://github.com/<you>/auto-subtitles-desktop.git
git branch -M main
git push -u origin main
```
