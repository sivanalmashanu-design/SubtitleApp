import type {
  CaptionBox,
  CaptionStyle,
  Segment,
  TextOverlay,
  VideoDims,
  WordTiming,
} from './types'
import { fontWidthRatio } from './fonts'
import { packRows } from './tracks'
import { buildPages, forcedBreakSet, pageLine, wordsForLine } from './words'

// Channels stack like layers: captions on top, then card rows top-to-bottom.
const CAPTION_LAYER = 50

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

// libass renders a given Fontsize a touch smaller than a browser renders the
// same px font-size, so the in-app preview looked bigger than the export. Nudge.
const SIZE_CAL = 1.08

/** `&HBBGGRR&` fill colour for an inline `\1c` / `\3c` tag. */
function assFill(hex: string): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  h = h.slice(0, 6).padEnd(6, '0')
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase()
}
const assAlpha = (a: number): string =>
  `&H${clamp(Math.round(a), 0, 255).toString(16).padStart(2, '0').toUpperCase()}&`

const RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/
export const isRtl = (s: string): boolean => RTL.test(s)

// Force an RTL embedding so trailing punctuation (comma, period) lands on the
// correct visual side. libass' bidi is weaker than the browser's; without this
// the export puts the comma on the wrong end of a Hebrew line.
const RLE = String.fromCodePoint(0x202b) // RIGHT-TO-LEFT EMBEDDING
const PDF = String.fromCodePoint(0x202c) // POP DIRECTIONAL FORMATTING
const bidi = (s: string, rtl: boolean): string => (rtl ? `${RLE}${s}${PDF}` : s)

/** Filled rounded-rectangle path for an ASS `\p1` drawing, origin at top-left. */
function roundRectPath(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  return [
    `m ${rr} 0`,
    `l ${w - rr} 0`,
    `b ${w} 0 ${w} 0 ${w} ${rr}`,
    `l ${w} ${h - rr}`,
    `b ${w} ${h} ${w} ${h} ${w - rr} ${h}`,
    `l ${rr} ${h}`,
    `b 0 ${h} 0 ${h} 0 ${h - rr}`,
    `l 0 ${rr}`,
    `b 0 0 0 0 ${rr} 0`,
  ].join(' ')
}

function assTime(s: number): string {
  const t = Math.max(0, s)
  const cs = Math.round((t - Math.floor(t)) * 100)
  const sec = Math.floor(t) % 60
  const min = Math.floor(t / 60) % 60
  const hr = Math.floor(t / 3600)
  const p = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${hr}:${p(min)}:${p(sec)}.${p(cs)}`
}

/** #RGB or #RRGGBB -> &HAABBGGRR (alpha 0 = opaque, 255 = transparent) */
function assColor(hex: string, alpha = 0): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  h = h.slice(0, 6).padEnd(6, '0')
  const a = clamp(Math.round(alpha), 0, 255)
  const hx = (n: number): string => n.toString(16).padStart(2, '0')
  return `&H${hx(a)}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase()
}

function clean(text: string, allCaps: boolean): string {
  const t = text
    .replace(/\\/g, '/')
    .replace(/[{}]/g, (c) => (c === '{' ? '(' : ')'))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
  return allCaps ? t.toUpperCase() : t
}

/** greedy word-wrap to `maxChars`, honouring explicit "\n" hard breaks */
function wrap(text: string, maxChars: number): string {
  return text
    .split('\n')
    .map((part) => {
      const lines: string[] = []
      let line = ''
      for (const w of part.trim().split(/\s+/).filter(Boolean)) {
        if (line && line.length + 1 + w.length > maxChars) {
          lines.push(line)
          line = w
        } else {
          line = line ? `${line} ${w}` : w
        }
      }
      if (line) lines.push(line)
      return lines.join('\\N')
    })
    .join('\\N')
}

interface Geom {
  cx: number
  cy: number
  marginLR: number
  maxChars: number
}

function geom(box: CaptionBox, W: number, H: number, fontSize: number, fontName: string): Geom {
  const boxW = clamp(Math.round((box.widthPct / 100) * W), 40, W)
  return {
    cx: Math.round((box.xPct / 100) * W),
    cy: Math.round((box.yPct / 100) * H),
    marginLR: Math.max(0, Math.round((W - boxW) / 2)),
    maxChars: Math.max(6, Math.floor(boxW / (fontSize * fontWidthRatio(fontName)))),
  }
}

const capFontSize = (st: CaptionStyle, H: number): number =>
  clamp(Math.round((st.fontScale / 100) * H * SIZE_CAL), 8, H)

/** One `[V4+ Styles]` row for a caption style (global or a per-line override).
 *  The background block is drawn as a separate rounded rectangle, not with
 *  BorderStyle=3, so this row is always the plain outline style. */
function styleRowFor(name: string, st: CaptionStyle, H: number, scale: number): string {
  const bg = st.background.enabled || st.preset === 'boxed'
  const karaoke = st.preset === 'karaoke'
  // a thin outline keeps text legible on the box; a full outline otherwise
  const outline = bg ? Math.max(1, Math.round(1.5 * scale)) : clamp(Math.round(st.outline * scale), 0, 40)
  return [
    name,
    st.fontName === 'System' ? 'Arial' : st.fontName,
    capFontSize(st, H),
    karaoke ? assColor(st.accentColor) : assColor(st.primaryColor),
    assColor(st.primaryColor),
    assColor('#000000'),
    assColor('#000000', 130),
    st.bold ? -1 : 0,
    0, 0, 0, 100, 100, 0, 0,
    1,
    outline,
    Math.round(2 * scale),
    5, 0, 0, 0, 1,
  ].join(',')
}

export function buildAss(
  segments: Segment[],
  wordPass: WordTiming[] | null,
  style: CaptionStyle,
  video: VideoDims,
  overlays: TextOverlay[] = [],
  delaySec = 0,
): string {
  const H = Math.max(240, Math.round(video.height || 1080))
  const W = Math.max(240, Math.round(video.width || 1080))
  const scale = H / 1080
  const shift = (t: number): number => Math.max(0, t + delaySec)

  const fontSize = clamp(Math.round((style.fontScale / 100) * H), 8, H)

  const styleRow = styleRowFor('Default', style, H, scale)
  const overrideRows = segments
    .map((seg, i) => (seg.styleOverride ? styleRowFor(`Seg${i}`, seg.styleOverride, H, scale) : null))
    .filter((r): r is string => r !== null)

  const overlayStyleRow = [
    'Overlay', 'Arial', fontSize,
    assColor('#ffffff'), assColor('#ffffff'), assColor('#000000'), assColor('#000000', 130),
    -1, 0, 0, 0, 100, 100, 0, 0, 1, Math.max(2, Math.round(6 * scale)), Math.round(2 * scale),
    5, 0, 0, 0, 1,
  ].join(',')

  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${styleRow}`,
    ...overrideRows.map((r) => `Style: ${r}`),
    `Style: ${overlayStyleRow}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]

  const events: string[] = []
  const cue = (
    layer: number,
    styleName: string,
    start: number,
    end: number,
    g: Geom,
    body: string,
  ): string =>
    `Dialogue: ${layer},${assTime(start)},${assTime(Math.max(end, start + 0.1))},${styleName},,${g.marginLR},${g.marginLR},0,,${body}`

  const popAnim = `\\fad(40,50)\\fscx52\\fscy52\\t(0,90,\\fscx112\\fscy112)\\t(90,160,\\fscx100\\fscy100)`

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const words = wordsForLine(seg, wordPass)
    if (words.length === 0) continue

    const st = seg.styleOverride ?? style
    const styleName = seg.styleOverride ? `Seg${i}` : 'Default'
    const segFontSize = capFontSize(st, H)
    const karaoke = st.preset === 'karaoke'
    const wordPop = st.preset === 'word-pop'
    const bg = st.background.enabled || st.preset === 'boxed'
    const bgAlpha = clamp(Math.round((1 - st.background.opacity) * 255), 0, 255)
    const rtl = isRtl(seg.text)
    const perPage = clamp(Math.round(st.linesOnScreen || 2), 1, 3)
    const box = seg.styleOverride ? st.box : (seg.box ?? style.box)
    const g = geom(box, W, H, segFontSize, st.fontName)
    const place = `\\an5\\pos(${g.cx},${g.cy})`
    const boxW = clamp(Math.round((box.widthPct / 100) * W), 40, W)
    const pages = buildPages(words, forcedBreakSet(seg.text), g.maxChars, perPage)

    for (const page of pages) {
      const nLines = page.lineStarts.length
      const start = shift(page.start)
      const end = shift(page.end)

      // one smooth rounded-rect behind the whole block (matches the app preview)
      if (bg) {
        const lineChars = Array.from({ length: nLines }, (_, k) =>
          pageLine(page, k).reduce((n, w) => n + w.word.length + 1, -1),
        )
        const widest = Math.max(1, ...lineChars)
        const padX = Math.round(segFontSize * 0.36)
        const padY = Math.round(segFontSize * 0.16)
        const bw = clamp(
          Math.round(widest * segFontSize * fontWidthRatio(st.fontName) + padX * 2),
          Math.round(segFontSize * 1.4),
          boxW,
        )
        const bh = Math.round(nLines * segFontSize * 1.2 + padY * 2)
        const x0 = Math.round(g.cx - bw / 2)
        const y0 = Math.round(g.cy - bh / 2)
        const r = Math.round(Math.min(bw, bh) * 0.12)
        events.push(
          `Dialogue: ${CAPTION_LAYER - 1},${assTime(start)},${assTime(Math.max(end, start + 0.1))},${styleName},,0,0,0,,` +
            `{\\an7\\pos(${x0},${y0})\\1c${assFill(st.background.color)}\\1a${assAlpha(bgAlpha)}` +
            `\\3a&HFF&\\4a&HFF&\\bord0\\shad0\\fad(120,110)\\p1}${roundRectPath(bw, bh, r)}{\\p0}`,
        )
      }

      if (karaoke) {
        let body = ''
        for (let k = 0; k < nLines; k++) {
          if (k) body += '\\N'
          let line = ''
          pageLine(page, k).forEach((w, j) => {
            line += `${j ? ' ' : ''}{\\k${clamp(Math.round((w.end - w.start) * 100), 1, 600)}}${clean(w.word, st.allCaps)}`
          })
          body += bidi(line, rtl)
        }
        events.push(cue(CAPTION_LAYER, styleName, start, end, g, `{${place}\\fad(90,60)}${body}`))
      } else {
        const text = Array.from({ length: nLines }, (_, k) =>
          bidi(
            pageLine(page, k)
              .map((w) => clean(w.word, st.allCaps))
              .join(' '),
            rtl,
          ),
        ).join('\\N')
        events.push(
          cue(
            CAPTION_LAYER,
            styleName,
            start,
            end,
            g,
            `{${place}${wordPop ? popAnim : '\\fad(120,110)'}}${text}`,
          ),
        )
      }
    }
  }

  const ovRows = packRows(overlays.map((o) => ({ id: o.id, start: o.start, end: o.end })))
  for (const ov of overlays) {
    if (!ov.text.trim()) continue
    // row 0 is the top card channel -> highest layer, still below captions
    const ovLayer = 20 - (ovRows.get(ov.id) ?? 0) * 2
    const ovSize = clamp(Math.round((ov.fontScale / 100) * H * SIZE_CAL), 8, H)
    const g = geom(ov.box, W, H, ovSize, ov.fontName)
    const boxed = ov.background.enabled
    const bgA = clamp(Math.round((1 - ov.background.opacity) * 255), 0, 255)
    const font = ov.fontName === 'System' ? 'Arial' : ov.fontName
    const ovRtl = isRtl(ov.text)
    const dur = Math.max(0.1, ov.end - ov.start) * 1000
    const off = Math.round(H * 0.05)
    const offX = Math.round(W * 0.14)

    let anim = ''
    let posTag = `\\pos(${g.cx},${g.cy})`
    switch (ov.animation) {
      case 'fade':
        anim = `\\fad(180,180)`
        break
      case 'pop':
        anim = `\\fad(60,120)\\fscx40\\fscy40\\t(0,140,\\fscx112\\fscy112)\\t(140,220,\\fscx100\\fscy100)`
        break
      case 'zoom':
        anim = `\\fad(60,120)\\fscx170\\fscy170\\t(0,220,\\fscx100\\fscy100)`
        break
      case 'slide-up':
        posTag = ''
        anim = `\\fad(140,140)\\move(${g.cx},${g.cy + off},${g.cx},${g.cy},0,${Math.min(280, dur)})`
        break
      case 'slide-down':
        posTag = ''
        anim = `\\fad(140,140)\\move(${g.cx},${g.cy - off},${g.cx},${g.cy},0,${Math.min(280, dur)})`
        break
      case 'slide-left':
        posTag = ''
        anim = `\\fad(140,140)\\move(${g.cx - offX},${g.cy},${g.cx},${g.cy},0,${Math.min(280, dur)})`
        break
      case 'slide-right':
        posTag = ''
        anim = `\\fad(140,140)\\move(${g.cx + offX},${g.cy},${g.cx},${g.cy},0,${Math.min(280, dur)})`
        break
      case 'wipe': {
        const bw = Math.round((ov.box.widthPct / 100) * W)
        const bh = Math.round(Math.max(ovSize * 1.6, (ov.box.heightPct / 100) * H))
        const x1 = g.cx - Math.round(bw / 2)
        const y1 = g.cy - Math.round(bh / 2)
        anim = `\\clip(${x1},${y1},${x1},${y1 + bh})\\t(0,${Math.min(320, dur)},\\clip(${x1},${y1},${x1 + bw},${y1 + bh}))`
        break
      }
    }

    const wrapped = wrap(clean(ov.text, ov.allCaps), g.maxChars)
    const ovLines = wrapped.split('\\N')
    const body = ovLines.map((l) => bidi(l, ovRtl)).join('\\N')

    // single rounded rect behind the text, matching the app preview
    if (boxed) {
      const widest = Math.max(1, ...ovLines.map((l) => l.length))
      const padX = Math.round(ovSize * 0.36)
      const padY = Math.round(ovSize * 0.16)
      const bw = clamp(
        Math.round(widest * ovSize * fontWidthRatio(ov.fontName) + padX * 2),
        Math.round(ovSize * 1.4),
        clamp(Math.round((ov.box.widthPct / 100) * W), 40, W),
      )
      const bh = Math.round(ovLines.length * ovSize * 1.2 + padY * 2)
      const x0 = Math.round(g.cx - bw / 2)
      const y0 = Math.round(g.cy - bh / 2)
      const r = Math.round(Math.min(bw, bh) * 0.12)
      events.push(
        `Dialogue: ${ovLayer - 1},${assTime(shift(ov.start))},${assTime(Math.max(shift(ov.end), shift(ov.start) + 0.1))},Overlay,,0,0,0,,` +
          `{\\an7\\pos(${x0},${y0})\\1c${assFill(ov.background.color)}\\1a${assAlpha(bgA)}` +
          `\\3a&HFF&\\4a&HFF&\\bord0\\shad0\\fad(150,150)\\p1}${roundRectPath(bw, bh, r)}{\\p0}`,
      )
    }

    const colTags = boxed
      ? `\\1c${assColor(ov.color)}\\bord${Math.max(1, Math.round(1.5 * scale))}`
      : `\\1c${assColor(ov.color)}\\bord${clamp(Math.round(ov.outline * scale), 0, 40)}`
    const tags = `\\an5${posTag}\\fn${font}\\fs${ovSize}\\b${ov.bold ? 1 : 0}${colTags}${anim}`
    events.push(cue(ovLayer, 'Overlay', shift(ov.start), shift(ov.end), g, `{${tags}}${body}`))
  }

  return head.concat(events).join('\n') + '\n'
}
