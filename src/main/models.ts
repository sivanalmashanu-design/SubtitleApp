import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ModelInfo } from '@shared/types'
import { modelsDir } from './paths'

/**
 * ggml Whisper weights from the whisper.cpp model repo. Full Large-v3 is the
 * default for best Hebrew accuracy; Large-v3 Turbo is the faster fallback
 * (same encoder, lighter decoder — nearly as good, several times quicker).
 */
export const MODELS: ModelInfo[] = [
  {
    id: 'large-v3',
    label: 'Large-v3 · full — most accurate (default)',
    file: 'ggml-large-v3.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin?download=true',
    approxMB: 3095,
  },
  {
    id: 'large-v3-turbo',
    label: 'Large-v3 Turbo · full — faster fallback',
    file: 'ggml-large-v3-turbo.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin?download=true',
    approxMB: 1624,
  },
]

export function modelById(id: string): ModelInfo {
  const m = MODELS.find((x) => x.id === id)
  if (!m) throw new Error(`Unknown model: ${id}`)
  return m
}

export function modelPath(id: string): string {
  return join(modelsDir(), modelById(id).file)
}

export async function isInstalled(id: string): Promise<boolean> {
  try {
    return (await stat(modelPath(id))).size > 1_000_000
  } catch {
    return false
  }
}

export async function listModels(): Promise<ModelInfo[]> {
  return Promise.all(MODELS.map(async (m) => ({ ...m, installed: await isInstalled(m.id) })))
}

export async function downloadModel(
  id: string,
  onProgress: (ratio: number, mb: number) => void,
): Promise<void> {
  const model = modelById(id)
  await mkdir(modelsDir(), { recursive: true })
  const dest = modelPath(id)
  const part = `${dest}.part`

  const res = await fetch(model.url)
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`)

  const total = Number(res.headers.get('content-length')) || model.approxMB * 1e6
  let received = 0
  const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    onProgress(Math.min(1, received / total), received / 1e6)
  })

  try {
    await pipeline(body, createWriteStream(part))
    await rename(part, dest)
  } catch (err) {
    await rm(part, { force: true })
    throw err
  }
}

export async function deleteModel(id: string): Promise<void> {
  await rm(modelPath(id), { force: true })
}
