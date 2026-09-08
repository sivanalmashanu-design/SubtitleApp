import { boxFit, buildPages, forcedBreakSet, wordsForLine } from '@shared/words'
import { isRtl } from '@shared/ass'
import type { CaptionBox, CaptionStyle, Segment, VideoDims, WordTiming } from '@shared/types'

interface Base {
  segId: string | null
  box: CaptionBox
  rtl: boolean
}

/** one rendered word: `wi` is its index within the whole caption line */
export interface WordSpan {
  text: string
  br: boolean
  wi: number
  color?: string
  fontName?: string
}

export type ActiveCaption =
  | ({ kind: 'none' } & Base)
  | ({ kind: 'line'; text: string; words: WordSpan[] } & Base)
  | ({ kind: 'pop'; chunkKey: string; text: string; words: WordSpan[] } & Base)
  | ({
      kind: 'karaoke'
      words: { text: string; spoken: boolean; active: boolean; br: boolean; wi: number }[]
    } & Base)

const DEMO_DIMS: VideoDims = { width: 608, height: 1080 }
const clampLines = (n: number): number => Math.max(1, Math.min(3, Math.round(n || 2)))

export function activeCaption(
  segments: Segment[],
  words: WordTiming[] | null,
  now: number,
  style: CaptionStyle,
  demo: boolean,
  delaySec: number,
  dims: VideoDims | null,
): ActiveCaption {
  const d = dims ?? DEMO_DIMS
  const t = now - delaySec
  const seg = segments.find((s) => t >= s.start && t < s.end) ?? null

  if (!seg) {
    if (!demo) return { kind: 'none', segId: null, box: style.box, rtl: false }
    const demoWords = ['your', 'captions', 'preview', 'like', 'this', 'in', 'the', 'box']
    if (style.preset === 'karaoke') {
      const cyc = (now % 4) / 4
      return {
        kind: 'karaoke',
        segId: 'demo',
        box: style.box,
        rtl: false,
        words: demoWords.slice(0, 5).map((w, i) => ({
          text: w,
          spoken: cyc > (i + 1) / 5,
          active: cyc > i / 5 && cyc <= (i + 1) / 5,
          br: false,
          wi: i,
        })),
      }
    }
    if (style.preset === 'word-pop') {
      const { maxChars } = boxFit(style.box, style.fontScale, d, style.fontName)
      const wt: WordTiming[] = demoWords.map((w, i) => ({ word: w, start: i, end: i + 1 }))
      const pages = buildPages(wt, new Set(), maxChars, clampLines(style.linesOnScreen))
      const gi = Math.floor(((now % 4) / 4) * pages.length)
      const pg = pages[Math.min(gi, pages.length - 1)] ?? pages[0]
      return {
        kind: 'pop',
        segId: 'demo',
        box: style.box,
        rtl: false,
        chunkKey: `demo-${gi}`,
        text: pg.words.map((x) => x.word).join(' '),
        words: pg.words.map((x, i) => ({ text: x.word, br: false, wi: i })),
      }
    }
    return {
      kind: 'line',
      segId: 'demo',
      box: style.box,
      rtl: false,
      text: 'your captions preview like this',
      words: 'your captions preview like this'.split(' ').map((x, i) => ({ text: x, br: false, wi: i })),
    }
  }

  const st = seg.styleOverride ?? style
  const box = seg.styleOverride ? st.box : (seg.box ?? style.box)
  const rtl = isRtl(seg.text)
  const w = wordsForLine(seg, words)
  const { maxChars } = boxFit(box, st.fontScale, d, st.fontName)
  const pages = buildPages(w, forcedBreakSet(seg.text), maxChars, clampLines(st.linesOnScreen))
  if (pages.length === 0) return { kind: 'none', segId: seg.id, box, rtl }

  // pick the page whose start is the latest one <= t, tracking the word offset
  let page = pages[0]
  let pageIdx = 0
  let wordOffset = 0
  let off = 0
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].start <= t) {
      page = pages[i]
      pageIdx = i
      wordOffset = off
    }
    off += pages[i].words.length
  }

  const lineIdxSet = new Set(page.lineStarts.slice(1))
  const ws = seg.wordStyles

  if (st.preset === 'karaoke') {
    return {
      kind: 'karaoke',
      segId: seg.id,
      box,
      rtl,
      words: page.words.map((x, i) => ({
        text: x.word,
        spoken: t >= x.end,
        active: t >= x.start && t < (page.words[i + 1]?.start ?? x.end),
        br: lineIdxSet.has(i),
        wi: wordOffset + i,
      })),
    }
  }

  const wordSpans: WordSpan[] = page.words.map((x, i) => {
    const wi = wordOffset + i
    const o = ws?.[wi]
    return { text: x.word, br: lineIdxSet.has(i), wi, color: o?.color, fontName: o?.fontName }
  })

  const text = page.words
    .map((x, i) => (lineIdxSet.has(i) ? `\n${x.word}` : x.word))
    .join(' ')
    .replace(/ \n/g, '\n')

  if (st.preset === 'word-pop') {
    return { kind: 'pop', segId: seg.id, box, rtl, chunkKey: `${seg.id}:${pageIdx}`, text, words: wordSpans }
  }
  return { kind: 'line', segId: seg.id, box, rtl, text, words: wordSpans }
}
