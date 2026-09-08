import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
}

const toWeb = (s: Readable): ReadableStream =>
  Readable.toWeb(s) as unknown as ReadableStream

/**
 * Serve a local file for `media://` with HTTP range support, so <video> can
 * seek and keep buffering past the first chunk.
 */
export async function serveFile(request: Request): Promise<Response> {
  const url = new URL(request.url)
  // media://local/<url-encoded absolute path>
  const filePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')

  let size: number
  try {
    size = (await stat(filePath)).size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const range = request.headers.get('Range')

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    let start = match && match[1] ? Number(match[1]) : 0
    let end = match && match[2] ? Number(match[2]) : size - 1
    if (Number.isNaN(start) || start < 0) start = 0
    if (Number.isNaN(end) || end >= size) end = size - 1
    if (start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      })
    }
    return new Response(toWeb(createReadStream(filePath, { start, end })), {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
      },
    })
  }

  return new Response(toWeb(createReadStream(filePath)), {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
    },
  })
}
