import { FONTS } from '@shared/fonts'

/** Register the bundled caption fonts.
 *  Served over `userfont://` (from the writable fonts dir that `ensureFonts()`
 *  populates on startup) rather than a `file://` URL — the packaged app's CSP
 *  `font-src 'self'` doesn't cover `file:` origins, so every bundled face
 *  silently failed and the preview fell back to a system font. */
export function injectFonts(): void {
  if (document.getElementById('caption-fonts')) return
  const css = FONTS.map(
    (f) =>
      `@font-face{font-family:'${f.name}';src:url('userfont://f/${encodeURIComponent(f.file)}') format('truetype');font-display:swap;}`,
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
