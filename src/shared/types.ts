export interface Segment {
  id: string
  /** seconds */
  start: number
  /** seconds */
  end: number
  text: string
  /** per-line position/size override; falls back to CaptionStyle.box when null */
  box?: CaptionBox | null
  /** per-line full style override; when set it renders this line instead of the global style */
  styleOverride?: CaptionStyle | null
  /** per-word style tweaks, keyed by word index within this line */
  wordStyles?: Record<number, WordStyle>
}

/** overrides for a single word; any unset field inherits the caption's style */
export interface WordStyle {
  color?: string
  fontName?: string
  bold?: boolean
  allCaps?: boolean
  /** outline width, px at a 1080-tall reference */
  outline?: number
  outlineColor?: string
  /** size as a % of the caption's font size (100 = same) */
  sizePct?: number
}

export interface WordTiming {
  /** seconds */
  start: number
  /** seconds */
  end: number
  word: string
}

export type CaptionPreset = 'word-pop' | 'karaoke' | 'clean' | 'boxed'

/** A rectangle on the video frame, as percentages of its width/height. */
export interface CaptionBox {
  /** horizontal centre, 0–100 */
  xPct: number
  /** vertical centre, 0–100 */
  yPct: number
  /** width, % of video width */
  widthPct: number
  /** height, % of video height — caps how much text fits (word-pop paginates) */
  heightPct: number
}

export interface CaptionBackground {
  enabled: boolean
  /** #RRGGBB */
  color: string
  /** 0–1 */
  opacity: number
}

export interface CaptionStyle {
  preset: CaptionPreset
  /** family name libass matches; 'System' uses the OS default */
  fontName: string
  /** caption size as a percentage of the video height */
  fontScale: number
  /** #RRGGBB — main text */
  primaryColor: string
  /** #RRGGBB — karaoke fill / pop tint */
  accentColor: string
  /** text outline width in px at a 1080-tall reference */
  outline: number
  /** #RRGGBB — outline / stroke colour (defaults to black) */
  outlineColor?: string
  allCaps: boolean
  bold: boolean
  /** word-pop: lines shown on screen at once (Captions-style "page breaks") */
  linesOnScreen: number
  box: CaptionBox
  background: CaptionBackground
  /** id of the last applied template, for highlighting it in the gallery */
  templateId?: string
}

export type OverlayAnimation =
  | 'none'
  | 'fade'
  | 'pop'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom'
  | 'wipe'

export const OVERLAY_ANIMATIONS: ReadonlyArray<{ id: OverlayAnimation; label: string }> = [
  { id: 'fade', label: 'Fade' },
  { id: 'pop', label: 'Pop' },
  { id: 'slide-up', label: 'Slide up' },
  { id: 'slide-down', label: 'Slide down' },
  { id: 'slide-left', label: 'Slide from left' },
  { id: 'slide-right', label: 'Slide from right' },
  { id: 'zoom', label: 'Zoom out' },
  { id: 'wipe', label: 'Wipe in' },
  { id: 'none', label: 'None' },
]

/** A free-standing text card (title, CTA, label) independent of the transcript. */
export interface TextOverlay {
  id: string
  text: string
  /** seconds */
  start: number
  /** seconds */
  end: number
  box: CaptionBox
  /** % of video height */
  fontScale: number
  fontName: string
  /** #RRGGBB */
  color: string
  allCaps: boolean
  bold: boolean
  outline: number
  animation: OverlayAnimation
  background: CaptionBackground
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  preset: 'word-pop',
  // Heebo has Hebrew glyphs — the default use case. Latin display fonts like
  // Anton have none, so they silently fall back and look wrong on export.
  fontName: 'Heebo',
  fontScale: 6,
  primaryColor: '#ffffff',
  accentColor: '#ffe14d',
  outline: 6,
  outlineColor: '#000000',
  allCaps: true,
  bold: true,
  linesOnScreen: 2,
  box: { xPct: 50, yPct: 76, widthPct: 78, heightPct: 22 },
  background: { enabled: false, color: '#000000', opacity: 0.6 },
}

export function newTextOverlay(atSeconds: number): TextOverlay {
  return {
    id: `ov-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    text: 'TITLE',
    start: Math.max(0, atSeconds),
    end: atSeconds + 3,
    box: { xPct: 50, yPct: 18, widthPct: 80, heightPct: 16 },
    fontScale: 7,
    fontName: 'Heebo',
    color: '#ffffff',
    allCaps: true,
    bold: true,
    outline: 5,
    animation: 'pop',
    background: { enabled: false, color: '#000000', opacity: 0.75 },
  }
}

export interface VideoDims {
  width: number
  height: number
}

export interface TranscriptResult {
  segments: Segment[]
  words: WordTiming[] | null
}

export interface JobProgress {
  stage: 'extract' | 'transcribe' | 'words' | 'burn'
  ratio: number
}

export interface ModelInfo {
  id: string
  label: string
  file: string
  url: string
  approxMB: number
  installed?: boolean
}

export interface ModelProgress {
  id: string
  ratio: number
  mb: number
}
