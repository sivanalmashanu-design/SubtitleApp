import type { CaptionStyle } from './types'

/** A named look applied wholesale, like the style templates in the Captions app. */
export interface CaptionTemplate {
  id: string
  name: string
  /** short line shown under the name */
  tag: string
  patch: Partial<
    Pick<
      CaptionStyle,
      | 'preset'
      | 'fontName'
      | 'primaryColor'
      | 'accentColor'
      | 'outline'
      | 'allCaps'
      | 'bold'
      | 'linesOnScreen'
      | 'background'
    >
  >
}

const bg = (color: string, opacity = 0.92): CaptionStyle['background'] => ({
  enabled: true,
  color,
  opacity,
})
const noBg: CaptionStyle['background'] = { enabled: false, color: '#000000', opacity: 0.6 }

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  { id: 'punch', name: 'Punch', tag: 'Word pop · bold', patch: { preset: 'word-pop', fontName: 'Anton', primaryColor: '#ffffff', accentColor: '#ffe14d', outline: 9, allCaps: true, bold: true, linesOnScreen: 2, background: noBg } },
  { id: 'hype', name: 'Hype', tag: 'Word pop · red key', patch: { preset: 'word-pop', fontName: 'Archivo Black', primaryColor: '#ffffff', accentColor: '#ff2d55', outline: 11, allCaps: true, bold: true, linesOnScreen: 2, background: noBg } },
  { id: 'beast', name: 'Beast', tag: 'Word pop · yellow', patch: { preset: 'word-pop', fontName: 'Archivo Black', primaryColor: '#ffe600', accentColor: '#00e0ff', outline: 15, allCaps: true, bold: true, linesOnScreen: 1, background: noBg } },
  { id: 'single', name: 'Single', tag: 'One word at a time', patch: { preset: 'word-pop', fontName: 'Montserrat', primaryColor: '#ffffff', accentColor: '#ffd400', outline: 8, allCaps: true, bold: true, linesOnScreen: 1, background: noBg } },
  { id: 'karaoke', name: 'Karaoke', tag: 'Word-by-word fill', patch: { preset: 'karaoke', fontName: 'Montserrat', primaryColor: '#ffffff', accentColor: '#ffd400', outline: 6, allCaps: true, bold: true, background: noBg } },
  { id: 'neon', name: 'Neon', tag: 'Word pop · glow', patch: { preset: 'word-pop', fontName: 'Bebas Neue', primaryColor: '#00e5ff', accentColor: '#ff00e5', outline: 5, allCaps: true, bold: true, linesOnScreen: 2, background: noBg } },
  { id: 'bar', name: 'Bar', tag: 'Black caption bar', patch: { preset: 'boxed', fontName: 'Poppins', primaryColor: '#ffffff', accentColor: '#111111', outline: 0, allCaps: false, bold: true, background: bg('#000000', 0.9) } },
  { id: 'sunburst', name: 'Sunburst', tag: 'Yellow block', patch: { preset: 'boxed', fontName: 'Montserrat', primaryColor: '#1b1b00', accentColor: '#1b1b00', outline: 0, allCaps: true, bold: true, background: bg('#ffd400', 0.95) } },
  { id: 'mint', name: 'Mint', tag: 'Rounded green block', patch: { preset: 'boxed', fontName: 'Fredoka', primaryColor: '#042f2a', accentColor: '#042f2a', outline: 0, allCaps: false, bold: true, background: bg('#00d19f', 0.95) } },
  { id: 'pop-pink', name: 'Pop Pink', tag: 'Word pop · pink', patch: { preset: 'word-pop', fontName: 'Baloo 2', primaryColor: '#ffffff', accentColor: '#ff4da6', outline: 8, allCaps: true, bold: true, linesOnScreen: 2, background: noBg } },
  { id: 'marker', name: 'Marker', tag: 'Handwritten', patch: { preset: 'word-pop', fontName: 'Permanent Marker', primaryColor: '#ffffff', accentColor: '#ffe14d', outline: 7, allCaps: false, bold: false, linesOnScreen: 2, background: noBg } },
  { id: 'comic', name: 'Comic', tag: 'Bangers · punchy', patch: { preset: 'word-pop', fontName: 'Bangers', primaryColor: '#ffffff', accentColor: '#ffd400', outline: 8, allCaps: true, bold: false, linesOnScreen: 2, background: noBg } },
  { id: 'clean', name: 'Clean', tag: 'Simple fade', patch: { preset: 'clean', fontName: 'Inter', primaryColor: '#ffffff', accentColor: '#ffffff', outline: 4, allCaps: false, bold: true, background: noBg } },
  { id: 'retro', name: 'Retro', tag: 'Script · fade', patch: { preset: 'clean', fontName: 'Lobster', primaryColor: '#ffffff', accentColor: '#ff5e5e', outline: 5, allCaps: false, bold: false, background: noBg } },
  { id: 'deep', name: 'Deep', tag: 'Serif · gold', patch: { preset: 'clean', fontName: 'Playfair Display', primaryColor: '#ffffff', accentColor: '#d4af37', outline: 4, allCaps: false, bold: true, background: noBg } },
]

export function applyTemplate(style: CaptionStyle, t: CaptionTemplate): CaptionStyle {
  return {
    ...style,
    ...t.patch,
    background: t.patch.background ?? style.background,
    templateId: t.id,
  }
}
