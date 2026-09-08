// Downloads (or builds) the whisper-cli and ffmpeg executables this app shells
// out to, into resources/bin/<os>/. Run per-platform: locally on Windows, and
// once per matrix leg in CI. Safe to re-run; skips work that's already done.
import { execFileSync, execSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { chmodSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import os from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAT = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
const OUT = join(ROOT, 'resources', 'bin', PLAT)
const TMP = join(os.tmpdir(), 'as-fetch-bin')

mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })

const log = (...a) => console.log('[fetch-binaries]', ...a)

async function download(url, dest) {
  log('GET', url)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

function unzip(zip, destDir) {
  mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${destDir}' -Force`],
      { stdio: 'inherit' },
    )
  } else {
    execFileSync('unzip', ['-o', zip, '-d', destDir], { stdio: 'inherit' })
  }
}

function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = findFile(p, name)
      if (hit) return hit
    } else if (entry.name.toLowerCase() === name.toLowerCase()) {
      return p
    }
  }
  return null
}

async function latestWhisperRelease() {
  const res = await fetch('https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest', {
    headers: { 'user-agent': 'auto-subtitles-build' },
  })
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------- ffmpeg

async function fetchFfmpeg() {
  const target = join(OUT, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (existsSync(target)) return log('ffmpeg already present')

  if (process.platform === 'win32') {
    const zip = join(TMP, 'ffmpeg-win.zip')
    await download(
      'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
      zip,
    )
    const dir = join(TMP, 'ffmpeg-win')
    rmSync(dir, { recursive: true, force: true })
    unzip(zip, dir)
    copyFileSync(findFile(dir, 'ffmpeg.exe'), target)
    assertLibass(target)
  } else if (process.platform === 'darwin') {
    // arm64 static builds. Each source is tried in order until one yields an
    // ffmpeg that actually has libass (required for burning in captions).
    const sources = [
      ['zip', 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip'],
      ['zip', 'https://www.osxexperts.net/ffmpeg8arm.zip'],
      ['zip', 'https://www.osxexperts.net/ffmpeg71arm.zip'],
    ]
    let ok = false
    for (const [kind, url] of sources) {
      try {
        const arc = join(TMP, `ffmpeg-mac.${kind}`)
        await download(url, arc)
        const dir = join(TMP, 'ffmpeg-mac')
        rmSync(dir, { recursive: true, force: true })
        unzip(arc, dir)
        copyFileSync(findFile(dir, 'ffmpeg'), target)
        chmodSync(target, 0o755)
        assertLibass(target)
        ok = true
        break
      } catch (e) {
        log('ffmpeg source failed:', url, '-', e.message)
      }
    }
    if (!ok) throw new Error('no macOS ffmpeg build with libass could be fetched')
  } else {
    throw new Error('linux ffmpeg fetch not implemented')
  }
  log('ffmpeg ->', target)
}

/** libass is what burns the captions in — a build without it silently produces
 *  a caption-less video, so fail loudly here instead. */
function assertLibass(ffmpegPath) {
  const out = execFileSync(ffmpegPath, ['-hide_banner', '-version'], { encoding: 'utf8' })
  if (!/enable-libass/.test(out)) {
    throw new Error('ffmpeg build is missing --enable-libass')
  }
  log('ffmpeg has libass ✓')
}

// ------------------------------------------------------------- whisper-cli

async function fetchWhisper() {
  const target = join(OUT, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
  if (existsSync(target)) return log('whisper-cli already present')

  if (process.platform === 'win32') {
    const rel = await latestWhisperRelease()
    const asset = rel.assets.find((a) => a.name === 'whisper-bin-x64.zip')
    if (!asset) throw new Error('whisper-bin-x64.zip not in latest release')
    const zip = join(TMP, 'whisper-win.zip')
    await download(asset.browser_download_url, zip)
    const dir = join(TMP, 'whisper-win')
    rmSync(dir, { recursive: true, force: true })
    unzip(zip, dir)
    const cli = findFile(dir, 'whisper-cli.exe')
    if (!cli) throw new Error('whisper-cli.exe not found in archive')
    const srcDir = dirname(cli)
    // whisper-cli.exe + the ggml/whisper runtime DLLs it loads (skip the
    // unrelated llama/parakeet/SDL2 tooling in the same archive).
    const keep = (f) =>
      f === 'whisper-cli.exe' || f === 'whisper.dll' || /^ggml.*\.dll$/i.test(f)
    for (const f of readdirSync(srcDir)) {
      if (keep(f)) copyFileSync(join(srcDir, f), join(OUT, f))
    }
  } else if (process.platform === 'darwin') {
    const rel = await latestWhisperRelease()
    const tag = rel.tag_name
    const src = join(TMP, 'whisper.cpp')
    rmSync(src, { recursive: true, force: true })
    log('cloning whisper.cpp', tag)
    execSync(
      `git clone --depth 1 --branch ${tag} https://github.com/ggml-org/whisper.cpp "${src}"`,
      { stdio: 'inherit' },
    )
    log('building whisper-cli with Metal (static)…')
    execSync(
      'cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF ' +
        '-DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON ' +
        '-DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF',
      { cwd: src, stdio: 'inherit' },
    )
    execSync('cmake --build build --config Release -j --target whisper-cli', {
      cwd: src,
      stdio: 'inherit',
    })
    const built = findFile(join(src, 'build'), 'whisper-cli')
    if (!built) throw new Error('build did not produce whisper-cli')
    copyFileSync(built, target)
    chmodSync(target, 0o755)
  } else {
    throw new Error('linux whisper build not implemented')
  }
  log('whisper-cli ->', target)
}

// ----------------------------------------------------------- caption fonts

// Static OFL TTFs from the expo/google-fonts repo. Bundled so burned captions
// look identical on every machine. Copied into resources/fonts/ (for libass)
// and src/renderer/public/fonts/ (for the in-app style preview).
// KEEP IN SYNC with src/shared/fonts.ts (remote + file).
const FONTS = [
  ['heebo/700Bold/Heebo_700Bold.ttf', 'Heebo.ttf'],
  ['assistant/700Bold/Assistant_700Bold.ttf', 'Assistant.ttf'],
  ['secular-one/400Regular/SecularOne_400Regular.ttf', 'SecularOne.ttf'],
  ['suez-one/400Regular/SuezOne_400Regular.ttf', 'SuezOne.ttf'],
  ['karantina/700Bold/Karantina_700Bold.ttf', 'Karantina.ttf'],
  ['alef/700Bold/Alef_700Bold.ttf', 'Alef.ttf'],
  ['frank-ruhl-libre/700Bold/FrankRuhlLibre_700Bold.ttf', 'FrankRuhlLibre.ttf'],
  ['noto-sans-hebrew/700Bold/NotoSansHebrew_700Bold.ttf', 'NotoSansHebrew.ttf'],
  ['anton/400Regular/Anton_400Regular.ttf', 'Anton.ttf'],
  ['bebas-neue/400Regular/BebasNeue_400Regular.ttf', 'BebasNeue.ttf'],
  ['teko/700Bold/Teko_700Bold.ttf', 'Teko.ttf'],
  ['oswald/600SemiBold/Oswald_600SemiBold.ttf', 'Oswald.ttf'],
  ['archivo-black/400Regular/ArchivoBlack_400Regular.ttf', 'ArchivoBlack.ttf'],
  ['passion-one/700Bold/PassionOne_700Bold.ttf', 'PassionOne.ttf'],
  ['russo-one/400Regular/RussoOne_400Regular.ttf', 'RussoOne.ttf'],
  ['bangers/400Regular/Bangers_400Regular.ttf', 'Bangers.ttf'],
  ['luckiest-guy/400Regular/LuckiestGuy_400Regular.ttf', 'LuckiestGuy.ttf'],
  ['montserrat/700Bold/Montserrat_700Bold.ttf', 'Montserrat.ttf'],
  ['poppins/700Bold/Poppins_700Bold.ttf', 'Poppins.ttf'],
  ['inter/600SemiBold/Inter_600SemiBold.ttf', 'Inter.ttf'],
  ['roboto/700Bold/Roboto_700Bold.ttf', 'Roboto.ttf'],
  ['rubik/700Bold/Rubik_700Bold.ttf', 'Rubik.ttf'],
  ['nunito/800ExtraBold/Nunito_800ExtraBold.ttf', 'Nunito.ttf'],
  ['baloo-2/700Bold/Baloo2_700Bold.ttf', 'Baloo2.ttf'],
  ['fredoka/600SemiBold/Fredoka_600SemiBold.ttf', 'Fredoka.ttf'],
  ['caveat/700Bold/Caveat_700Bold.ttf', 'Caveat.ttf'],
  ['permanent-marker/400Regular/PermanentMarker_400Regular.ttf', 'PermanentMarker.ttf'],
  ['shrikhand/400Regular/Shrikhand_400Regular.ttf', 'Shrikhand.ttf'],
  ['lobster/400Regular/Lobster_400Regular.ttf', 'Lobster.ttf'],
  ['playfair-display/800ExtraBold/PlayfairDisplay_800ExtraBold.ttf', 'PlayfairDisplay.ttf'],
]

async function fetchFonts() {
  const dirs = [
    join(ROOT, 'resources', 'fonts'),
    join(ROOT, 'src', 'renderer', 'public', 'fonts'),
  ]
  for (const d of dirs) mkdirSync(d, { recursive: true })

  for (const [remote, name] of FONTS) {
    const primary = join(dirs[0], name)
    if (!existsSync(primary)) {
      await download(
        `https://cdn.jsdelivr.net/gh/expo/google-fonts@master/font-packages/${remote}`,
        primary,
      )
    }
    for (const d of dirs.slice(1)) copyFileSync(primary, join(d, name))
  }
  log('fonts ready in resources/fonts + src/renderer/public/fonts')
}

// --------------------------------------------------------------------

try {
  await fetchFfmpeg()
  await fetchWhisper()
  await fetchFonts()
  log('done. Contents of', OUT)
  for (const f of readdirSync(OUT)) log('  ', f)
} catch (err) {
  console.error('[fetch-binaries] FAILED:', err.message)
  process.exit(1)
}
