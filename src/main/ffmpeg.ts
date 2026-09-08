import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { exe, fontsDir, scratchDir } from './paths'

function run(
  bin: string,
  args: string[],
  onLine?: (line: string) => void,
  allowNonZero = false,
  cwd?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, cwd })
    let buf = ''
    let all = ''
    const feed = (chunk: Buffer): void => {
      const text = chunk.toString()
      all += text
      buf += text
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) onLine?.(line)
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('error', reject)
    child.on('close', (code) => {
      if (buf.trim()) onLine?.(buf)
      if (code === 0 || allowNonZero) resolve(all)
      else reject(new Error(`${bin} exited ${code}\n${all.slice(-2500)}`))
    })
  })
}

const parseClock = (h: string, m: string, s: string): number =>
  Number(h) * 3600 + Number(m) * 60 + Number(s)

/** Read a media file's duration in seconds (via `ffmpeg -i`, which exits non-zero). */
export async function probeDuration(input: string): Promise<number> {
  let seconds = 0
  await run(
    exe('ffmpeg'),
    ['-hide_banner', '-i', input],
    (line) => {
      const m = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (m) seconds = parseClock(m[1], m[2], m[3])
    },
    true,
  )
  return seconds
}

/** Extract 16 kHz mono PCM WAV for Whisper. Returns the wav path. */
export async function extractAudio(input: string): Promise<string> {
  await mkdir(scratchDir(), { recursive: true })
  const out = join(scratchDir(), `audio-${Date.now()}.wav`)
  await run(exe('ffmpeg'), [
    '-hide_banner',
    '-y',
    '-i',
    input,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    out,
  ])
  return out
}

/** Escape a path for the value side of an ffmpeg filter option. */
function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

/**
 * Re-encode the video with an ASS subtitle file rendered in (libass), using the
 * bundled caption fonts. `assContent` is a full .ass document.
 */
export async function burnCaptions(
  input: string,
  assContent: string,
  outPath: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const dir = scratchDir()
  await mkdir(dir, { recursive: true })
  const assName = `caps-${Date.now()}.ass`
  const assPath = join(dir, assName)
  await writeFile(assPath, assContent, 'utf8')

  const total = await probeDuration(input).catch(() => 0)
  // Run with cwd = scratch dir so the .ass file is referenced by bare name
  // (avoids ffmpeg's brittle drive-letter-colon filter escaping on Windows).
  const filter = `ass='${assName}':fontsdir='${escapeFilterPath(fontsDir())}'`

  try {
    await run(
      exe('ffmpeg'),
      [
        '-hide_banner',
        '-y',
        '-i',
        input,
        '-vf',
        filter,
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        outPath,
      ],
      (line) => {
        const m = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
        if (m && total > 0) onProgress(Math.min(1, parseClock(m[1], m[2], m[3]) / total))
      },
      false,
      dir,
    )
  } finally {
    await rm(assPath, { force: true })
  }
}
