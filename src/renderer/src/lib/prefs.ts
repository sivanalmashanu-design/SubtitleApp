import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from '@shared/types'

const STYLE_KEY = 'as:lastStyle'
const LANG_KEY = 'as:lastLanguage'
const GUIDES_KEY = 'as:guides'

/** Last caption style the user worked with — the default for the next new project. */
export function loadLastStyle(): CaptionStyle {
  try {
    const raw = localStorage.getItem(STYLE_KEY)
    if (!raw) return DEFAULT_CAPTION_STYLE
    const p = JSON.parse(raw) as Partial<CaptionStyle>
    return {
      ...DEFAULT_CAPTION_STYLE,
      ...p,
      box: { ...DEFAULT_CAPTION_STYLE.box, ...(p.box ?? {}) },
      background: { ...DEFAULT_CAPTION_STYLE.background, ...(p.background ?? {}) },
    }
  } catch {
    return DEFAULT_CAPTION_STYLE
  }
}

export function saveLastStyle(s: CaptionStyle): void {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable — no-op */
  }
}

export function loadLastLanguage(): string {
  try {
    return localStorage.getItem(LANG_KEY) || 'he'
  } catch {
    return 'he'
  }
}

export function saveLastLanguage(l: string): void {
  try {
    localStorage.setItem(LANG_KEY, l)
  } catch {
    /* storage unavailable — no-op */
  }
}

export function loadGuides(): 'none' | 'tiktok' | 'instagram' {
  try {
    const v = localStorage.getItem(GUIDES_KEY)
    return v === 'tiktok' || v === 'instagram' ? v : 'none'
  } catch {
    return 'none'
  }
}

export function saveGuides(v: string): void {
  try {
    localStorage.setItem(GUIDES_KEY, v)
  } catch {
    /* storage unavailable — no-op */
  }
}
