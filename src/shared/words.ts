import { fontWidthRatio } from './fonts'
import type { CaptionBox, Segment, VideoDims, WordTiming } from './types'

const tokenize = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean)

/** Spread a line's words across [start, end], weighting by word length. */
export function distributeWords(text: string, start: number, end: number): WordTiming[] {
  const tokens = tokenize(text)
  if (tokens.length === 0) return []
  const weights = tokens.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}']/gu, '').length))
  const total = weights.reduce((a, b) => a + b, 0)
  const span = Math.max(0.05, end - start)
  let t = start
  return tokens.map((word, i) => {
    const dur = (weights[i] / total) * span
    const w: WordTiming = { word, start: t, end: t + dur }
    t += dur
    return w
  })
}

const mid = (w: WordTiming): number => (w.start + w.end) / 2

/** Per-word timings for one caption line. */
export function wordsForLine(line: Segment, wordPass: WordTiming[] | null): WordTiming[] {
  const tokens = tokenize(line.text)
  if (tokens.length === 0) return []

  if (wordPass && wordPass.length) {
    const inLine = wordPass.filter((w) => mid(w) >= line.start - 0.2 && mid(w) <= line.end + 0.2)
    const tolerance = Math.max(1, Math.round(tokens.length * 0.34))
    if (inLine.length > 0 && Math.abs(inLine.length - tokens.length) <= tolerance) {
      let prevEnd = line.start
      return tokens.map((word, i) => {
        const src = inLine[Math.min(i, inLine.length - 1)]
        const start = Math.max(prevEnd, src ? src.start : line.start)
        const end = Math.max(start + 0.06, src ? src.end : line.end)
        prevEnd = end
        return { word, start, end }
      })
    }
  }
  return distributeWords(line.text, line.start, line.end)
}

/** How much text fits in `box`, given the font size, as chars-per-line and lines. */
export function boxFit(
  box: CaptionBox,
  fontScalePct: number,
  dims: VideoDims,
  fontName: string,
): { maxChars: number; maxLines: number } {
  const W = Math.max(1, dims.width || 1080)
  const H = Math.max(1, dims.height || 1080)
  const boxW = (box.widthPct / 100) * W
  const boxH = (box.heightPct / 100) * H
  const fontPx = Math.max(1, (fontScalePct / 100) * H)
  return {
    maxChars: Math.max(4, Math.floor(boxW / (fontPx * fontWidthRatio(fontName)))),
    maxLines: Math.max(1, Math.floor(boxH / (fontPx * 1.28))),
  }
}

/** Word indices after which the user forced a line break (a "\n" in the text). */
export function forcedBreakSet(text: string): Set<number> {
  const parts = text.split('\n')
  const breaks = new Set<number>()
  let idx = 0
  parts.forEach((part, i) => {
    const n = tokenize(part).length
    idx += n
    if (i < parts.length - 1 && n > 0) breaks.add(idx - 1)
  })
  return breaks
}

export interface CaptionPage {
  /** words shown on this page, in order */
  words: WordTiming[]
  /** index into `words` where each visual line starts */
  lineStarts: number[]
  start: number
  end: number
}

/**
 * Lay a line's words out into visual lines (auto-wrap to `maxChars`, plus the
 * user's forced breaks), then group those lines into pages of `linesPerPage`.
 * This is the single model behind every caption style.
 */
export function buildPages(
  words: WordTiming[],
  forcedBreaks: Set<number>,
  maxChars: number,
  linesPerPage: number,
): CaptionPage[] {
  const lines: WordTiming[][] = []
  let cur: WordTiming[] = []
  let len = 0
  words.forEach((w, i) => {
    const wl = Math.max(1, w.word.length)
    if (cur.length === 0) {
      cur = [w]
      len = wl
    } else if (len + 1 + wl <= maxChars) {
      cur.push(w)
      len += 1 + wl
    } else {
      lines.push(cur)
      cur = [w]
      len = wl
    }
    if (forcedBreaks.has(i)) {
      lines.push(cur)
      cur = []
      len = 0
    }
  })
  if (cur.length) lines.push(cur)

  const per = Math.max(1, Math.round(linesPerPage))
  const pages: CaptionPage[] = []
  for (let i = 0; i < lines.length; i += per) {
    const grp = lines.slice(i, i + per)
    const flat = grp.flat()
    if (flat.length === 0) continue
    const lineStarts: number[] = []
    let acc = 0
    for (const ln of grp) {
      lineStarts.push(acc)
      acc += ln.length
    }
    pages.push({ words: flat, lineStarts, start: flat[0].start, end: flat[flat.length - 1].end })
  }
  for (let i = 0; i < pages.length - 1; i++) {
    pages[i].end = Math.min(pages[i].end + 0.12, pages[i + 1].start)
  }
  if (pages.length) pages[pages.length - 1].end += 0.12
  return pages
}

/** words for line k of a page */
export function pageLine(page: CaptionPage, k: number): WordTiming[] {
  return page.words.slice(page.lineStarts[k], page.lineStarts[k + 1] ?? page.words.length)
}
