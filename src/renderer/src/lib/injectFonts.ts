import { FONTS } from '@shared/fonts'

/** Register the bundled caption fonts (served from /fonts by Vite / packaged). */
export function injectFonts(): void {
  if (document.getElementById('caption-fonts')) return
  const css = FONTS.map(
    (f) =>
      `@font-face{font-family:'${f.name}';src:url('/fonts/${f.file}') format('truetype');font-display:swap;}`,
  ).join('\n')
  const el = document.createElement('style')
  el.id = 'caption-fonts'
  el.textContent = css
  document.head.appendChild(el)
}

/** Register user-imported fonts (served by the main process via userfont://). */
export function injectCustomFonts(fonts: { family: string; file: string }[]): void {
  const id = 'custom-fonts'
  const el = document.getElementById(id) ?? document.createElement('style')
  el.id = id
  el.textContent = fonts
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';src:url('userfont://f/${encodeURIComponent(f.file)}');font-display:swap;}`,
    )
    .join('\n')
  if (!el.parentNode) document.head.appendChild(el)
}
