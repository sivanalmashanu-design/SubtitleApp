import type { Segment, TextRun, WordStyle } from './types'

/** the caption text the runs' offsets are measured against */
export const normText = (s: string): string => s.replace(/\s+/g, ' ').trim()

const STYLE_KEYS: (keyof WordStyle)[] = [
  'color',
  'fontName',
  'bold',
  'allCaps',
  'outline',
  'outlineColor',
  'sizePct',
]

const pickStyle = (r: WordStyle): WordStyle => {
  const o: WordStyle = {}
  for (const k of STYLE_KEYS) if (r[k] !== undefined) (o as Record<string, unknown>)[k] = r[k]
  return o
}

export const hasAnyStyle = (o: WordStyle | undefined): boolean =>
  !!o && STYLE_KEYS.some((k) => o[k] !== undefined)

/** styled ranges for a segment, migrating the legacy `wordStyles` map if needed */
export function styledRuns(seg: Segment): TextRun[] {
  if (seg.runs?.length) return seg.runs
  if (seg.wordStyles) {
    const words = normText(seg.text).split(' ').filter(Boolean)
    const out: TextRun[] = []
    let pos = 0
    words.forEach((w, i) => {
      const o = seg.wordStyles?.[i]
      if (hasAnyStyle(o)) out.push({ from: pos, to: pos + w.length, ...pickStyle(o as WordStyle) })
      pos += w.length + 1
    })
    return out
  }
  return []
}

export interface Frag {
  text: string
  s?: WordStyle
}

/** split one word (at char offset `start` in the normalised text) into fragments
 *  where the effective style is constant; later runs override earlier ones */
export function wordFrags(start: number, word: string, runs: TextRun[]): Frag[] {
  const end = start + word.length
  const cuts = new Set<number>([0, word.length])
  for (const r of runs) {
    if (r.to <= start || r.from >= end) continue
    cuts.add(Math.max(0, r.from - start))
    cuts.add(Math.min(word.length, r.to - start))
  }
  const pts = [...cuts].sort((a, b) => a - b)
  const out: Frag[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (a === b) continue
    const mid = start + (a + b) / 2
    let s: WordStyle | undefined
    for (const r of runs) {
      if (r.from <= mid && mid < r.to) s = { ...s, ...pickStyle(r) }
    }
    out.push({ text: word.slice(a, b), s: hasAnyStyle(s) ? s : undefined })
  }
  return out.length ? out : [{ text: word }]
}

/** offset in `normText(raw)` lining up with raw-string offset `idx`
 *  (collapses whitespace runs and drops leading whitespace, like normText) */
export function rawToNorm(raw: string, idx: number): number {
  let out = 0
  let prevSpace = true
  const n = Math.min(idx, raw.length)
  for (let i = 0; i < n; i++) {
    if (/\s/.test(raw[i])) {
      if (!prevSpace) {
        out++
        prevSpace = true
      }
    } else {
      out++
      prevSpace = false
    }
  }
  return out
}

export interface LaidWord {
  word: string
  /** char offset in the normalised text */
  from: number
  to: number
  /** starts a new hard line (explicit "\n" in the source) */
  br: boolean
}

/** split a plain text (e.g. a card) into words carrying their normalised-text
 *  offsets and hard-break flags, so `runs` can be applied and it can be wrapped */
export function textWordLayout(text: string): LaidWord[] {
  const out: LaidWord[] = []
  let norm = 0
  let prevSpace = true
  let pendingBreak = false
  let cur = ''
  let curStart = 0
  const flush = (): void => {
    if (!cur) return
    out.push({ word: cur, from: curStart, to: curStart + cur.length, br: pendingBreak && out.length > 0 })
    cur = ''
    pendingBreak = false
  }
  for (const ch of text) {
    if (ch === '\n') {
      flush()
      if (!prevSpace) {
        norm++
        prevSpace = true
      }
      pendingBreak = true
      continue
    }
    if (/\s/.test(ch)) {
      flush()
      if (!prevSpace) {
        norm++
        prevSpace = true
      }
      continue
    }
    if (!cur) curStart = norm
    cur += ch
    norm++
    prevSpace = false
  }
  flush()
  return out
}

/** char offset of each word (in `words` order) within the normalised text */
export function wordCharOffsets(words: string[]): number[] {
  const out: number[] = []
  let p = 0
  for (const w of words) {
    out.push(p)
    p += w.length + 1
  }
  return out
}

const sameStyle = (a: WordStyle | undefined, b: WordStyle | undefined): boolean =>
  STYLE_KEYS.every((k) => a?.[k] === b?.[k])

/** the effective style at a single char offset (later runs win per field) */
function styleAt(runs: TextRun[], i: number): WordStyle {
  let s: WordStyle = {}
  for (const r of runs) if (r.from <= i && i < r.to) s = { ...s, ...pickStyle(r) }
  return s
}

/** style shared by every char in [from,to) — a field is reported only when it
 *  holds the same value across the whole range (so the editor shows "mixed" as
 *  unset) */
export function rangeStyle(runs: TextRun[], from: number, to: number): WordStyle {
  if (to <= from) return {}
  const first = styleAt(runs, from)
  const out: WordStyle = {}
  for (const k of STYLE_KEYS) {
    const v = first[k]
    if (v === undefined) continue
    let same = true
    for (let i = from + 1; i < to; i++) {
      if (styleAt(runs, i)[k] !== v) {
        same = false
        break
      }
    }
    if (same) (out as Record<string, unknown>)[k] = v
  }
  return out
}

/** merge `patch` into [from,to) over the whole caption (null clears that span),
 *  then re-coalesce into minimal runs */
export function editRuns(
  runs: TextRun[],
  textLen: number,
  from: number,
  to: number,
  patch: WordStyle | null,
): TextRun[] {
  const chars: (WordStyle | undefined)[] = new Array(textLen)
  for (const r of runs) {
    for (let i = Math.max(0, r.from); i < Math.min(textLen, r.to); i++) {
      chars[i] = { ...chars[i], ...pickStyle(r) }
    }
  }
  for (let i = Math.max(0, from); i < Math.min(textLen, to); i++) {
    chars[i] = patch === null ? undefined : { ...chars[i], ...patch }
  }
  const out: TextRun[] = []
  let i = 0
  while (i < textLen) {
    if (!hasAnyStyle(chars[i])) {
      i++
      continue
    }
    let j = i + 1
    while (j < textLen && sameStyle(chars[j], chars[i])) j++
    out.push({ from: i, to: j, ...(chars[i] as WordStyle) })
    i = j
  }
  return out
}
