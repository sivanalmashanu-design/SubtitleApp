import type { Segment } from './types'

function pad(n: number, len = 2): string {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0')
}

/** seconds -> "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" (VTT) */
export function formatTimestamp(seconds: number, comma = true): string {
  const total = Math.max(0, seconds)
  const ms = Math.round((total - Math.floor(total)) * 1000)
  const s = Math.floor(total) % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? ',' : '.'}${pad(ms, 3)}`
}

const usable = (segments: Segment[]) =>
  segments.filter((s) => s.text.trim() && s.end > s.start).sort((a, b) => a.start - b.start)

export function toSRT(segments: Segment[]): string {
  return (
    usable(segments)
      .map(
        (s, i) =>
          `${i + 1}\n${formatTimestamp(s.start)} --> ${formatTimestamp(s.end)}\n${s.text.trim()}\n`,
      )
      .join('\n') + '\n'
  )
}

export function toVTT(segments: Segment[]): string {
  const body = usable(segments)
    .map(
      (s, i) =>
        `${i + 1}\n${formatTimestamp(s.start, false)} --> ${formatTimestamp(s.end, false)}\n${s.text.trim()}\n`,
    )
    .join('\n')
  return `WEBVTT\n\n${body}\n`
}
