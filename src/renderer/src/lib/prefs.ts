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

// ---- favourites -----------------------------------------------------------
const FAV_FONTS_KEY = 'as:favFonts'
const FAV_STYLES_KEY = 'as:favStyles'

export interface FavStyle {
  id: string
  name: string
  style: CaptionStyle
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* no-op */
  }
}

export const loadFavFonts = (): string[] =>
  readJson<string[]>(FAV_FONTS_KEY, []).filter((x) => typeof x === 'string')

export function toggleFavFont(name: string): string[] {
  const cur = loadFavFonts()
  const next = cur.includes(name) ? cur.filter((f) => f !== name) : [...cur, name]
  writeJson(FAV_FONTS_KEY, next)
  return next
}

export const loadFavStyles = (): FavStyle[] => readJson<FavStyle[]>(FAV_STYLES_KEY, [])

export function addFavStyle(name: string, style: CaptionStyle): FavStyle[] {
  const fav: FavStyle = {
    id: `fs-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
    name,
    style,
  }
  const next = [...loadFavStyles(), fav]
  writeJson(FAV_STYLES_KEY, next)
  return next
}

export function removeFavStyle(id: string): FavStyle[] {
  const next = loadFavStyles().filter((f) => f.id !== id)
  writeJson(FAV_STYLES_KEY, next)
  return next
}

export function renameFavStyle(id: string, name: string): FavStyle[] {
  const next = loadFavStyles().map((f) => (f.id === id ? { ...f, name } : f))
  writeJson(FAV_STYLES_KEY, next)
  return next
}
