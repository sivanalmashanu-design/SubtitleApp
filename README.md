# Auto Subtitles (desktop)

An offline desktop app for **animated social captions**: transcribe a phone video
with **whisper.cpp** (Hebrew‑capable `large‑v3‑turbo`), style the captions, and
burn them into a new MP4 with **ffmpeg** + libass. Nothing is uploaded.

- macOS (Apple Silicon): transcription runs on the Metal GPU — near real‑time.
- Windows: transcription runs on the CPU — a few‑minute clip takes a few minutes.

**Layout** auto‑detects the video's orientation: vertical (Reels/TikTok) by
default, landscape when you load a landscape clip. No cropping.

**Caption styles** (per video): word‑by‑word pop, karaoke word‑highlight, clean
fade, or boxed. 22 bundled fonts + system + custom, size, text/accent/background
colour + opacity, outline, ALL CAPS. The caption block is a **free box** — drag
it anywhere on the preview and resize its width; text wraps inside it. A second
word‑level Whisper pass times each word so the animations land on the beat
(falls back to an even spread if a line is edited heavily).

The app layout has a **draggable divider** between the player/style column and
the transcript column (remembered per machine); the Transcription and Caption
style panels collapse.

## Develop

```bash
npm install
npm run fetch-binaries      # downloads whisper-cli + ffmpeg for THIS OS into resources/bin/
npm run dev
```

`npm run fetch-binaries`:

- **Windows** – downloads `whisper-cli.exe` (whisper.cpp release) and a static
  `ffmpeg.exe` (BtbN GPL build, has libx264 + libass).
- **macOS** – downloads a static arm64 `ffmpeg`, and **compiles** `whisper-cli`
  from source with Metal enabled (needs Xcode command‑line tools + cmake, which
  GitHub's macOS runners already have).

Models are **not** bundled. On first run the app downloads the chosen ggml model
into the user‑data folder (`large‑v3‑turbo‑q5_0` ≈ 550 MB) and caches it.

## Build installers

Locally, for the current OS only:

```bash
npm run pack:win     # -> dist/Auto Subtitles-<ver>-win-x64.exe   (NSIS)
npm run pack:mac     # -> dist/Auto Subtitles-<ver>-arm64.dmg     (needs a Mac)
```

You have no Mac, so the `.dmg` is produced by **GitHub Actions**
(`.github/workflows/build.yml`): push a `vX.Y.Z` tag and it builds both the
Windows `.exe` and the Apple‑Silicon `.dmg` on their respective runners and
attaches them to a Release. Download the `.dmg`, send it to the Mac.

The apps are **unsigned**. First launch:

- **macOS**: right‑click the app → *Open* → *Open* (once). If it still refuses,
  `xattr -dr com.apple.quarantine "/Applications/Auto Subtitles.app"`.
- **Windows**: *More info* → *Run anyway* on the SmartScreen prompt.

## How it works

| Step | Tool | Detail |
|---|---|---|
| Audio extract | ffmpeg | `-vn -ac 1 -ar 16000 -c:a pcm_s16le` → 16 kHz mono WAV |
| Transcribe (lines) | whisper-cli | `-oj` JSON with ms offsets → editable `Segment[]` |
| Transcribe (words) | whisper-cli | second pass `-ml 1 -sow` → per‑word timings for the animations |
| Edit / preview | renderer | transcript synced to the player; a static in‑player style preview |
| Generate `.ass` | `src/shared/ass.ts` | per‑preset override tags — `\fad`, `\t` scale pop, `\k` karaoke — at the video's real `PlayResX/Y` |
| Burn in | ffmpeg | `ass=` filter with `fontsdir` = bundled `resources/fonts`; libass FriBidi+HarfBuzz → correct Hebrew RTL; `libx264` + `aac` |

`npm run fetch-binaries` also downloads the 7 caption fonts (OFL, from
`expo/google-fonts` via jsDelivr) into `resources/fonts/` and
`src/renderer/public/fonts/`.

Main process shells out to the two binaries and streams progress over IPC; the
renderer is the React UI. Local video plays through a custom `media://` protocol
so `webSecurity` stays on.
