import { spawn } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { cpus } from 'node:os'
import type { Segment, TranscriptResult, WordTiming } from '@shared/types'
import { exe } from './paths'
import { extractAudio } from './ffmpeg'
import { modelPath } from './models'

interface WhisperCliEntry {
  offsets: { from: number; to: number } // milliseconds
  text: string
}
interface WhisperCliJson {
  transcription: WhisperCliEntry[]
}

export interface TranscribeOptions {
  modelId: string
  /** ISO code like "he", "en", or null for auto-detect */
  language: string | null
  /** run the extra word-level pass */
  wordTimings: boolean
}

const THREADS = Math.max(2, Math.min(8, cpus().length - 1))

function runWhisper(
  wav: string,
  outBase: string,
  modelId: string,
  language: string | null,
  extraArgs: string[],
  onPct: (ratio: number) => void,
): Promise<WhisperCliEntry[]> {
  const args = [
    '-m', modelPath(modelId),
    '-f', wav,
    '-l', language ?? 'auto',
    '-t', String(THREADS),
    '-pp',
    '-oj',
    '-of', outBase,
    ...extraArgs,
  ]
  return new Promise((resolve, reject) => {
    const child = spawn(exe('whisper-cli'), args, { windowsHide: true })
    let log = ''
    const feed = (chunk: Buffer): void => {
      const text = chunk.toString()
      log += text
      const m = [...text.matchAll(/progress\s*=\s*(\d+)%/g)].pop()
      if (m) onPct(Math.min(0.99, Number(m[1]) / 100))
    }
    child.stdout.on('data', feed)
    child.stderr.on('data', feed)
    child.on('error', reject)
    child.on('close', async (code) => {
      if (code !== 0) return reject(new Error(`whisper-cli exited ${code}\n${log.slice(-2500)}`))
      try {
        const parsed = JSON.parse(await readFile(`${outBase}.json`, 'utf8')) as WhisperCliJson
        resolve(parsed.transcription ?? [])
      } catch (err) {
        reject(err)
      }
    })
  })
}

export async function transcribe(
  videoPath: string,
  opts: TranscribeOptions,
  onProgress: (stage: 'extract' | 'transcribe' | 'words', ratio: number) => void,
): Promise<TranscriptResult> {
  onProgress('extract', 0)
  const wav = await extractAudio(videoPath)
  const base = wav.replace(/\.wav$/i, '')

  onProgress('transcribe', 0)
  const lineEntries = await runWhisper(wav, `${base}-lines`, opts.modelId, opts.language, [], (r) =>
    onProgress('transcribe', r),
  )
  onProgress('transcribe', 1)

  const segments: Segment[] = lineEntries
    .map((t, i) => ({
      id: `seg-${i}`,
      start: t.offsets.from / 1000,
      end: t.offsets.to / 1000,
      text: t.text.trim(),
    }))
    .filter((s) => s.text.length > 0 && s.end > s.start)

  let words: WordTiming[] | null = null
  if (opts.wordTimings) {
    onProgress('words', 0)
    const wordEntries = await runWhisper(
      wav,
      `${base}-words`,
      opts.modelId,
      opts.language,
      ['-ml', '1', '-sow'],
      (r) => onProgress('words', r),
    )
    onProgress('words', 1)
    words = wordEntries
      .map((t) => ({
        start: t.offsets.from / 1000,
        end: t.offsets.to / 1000,
        word: t.text.trim(),
      }))
      .filter((w) => w.word.length > 0 && w.end > w.start)
  }

  await Promise.allSettled([
    rm(wav, { force: true }),
    rm(`${base}-lines.json`, { force: true }),
    rm(`${base}-words.json`, { force: true }),
  ])

  return { segments, words }
}
