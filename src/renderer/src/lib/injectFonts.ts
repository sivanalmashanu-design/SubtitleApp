import { FONTS } from '@shared/fonts'

/** Register the bundled caption fonts.
 *  Two `src` URLs per face: `userfont://` (works in the packaged app — the CSP
 *  `font-src 'self'` does NOT cover the `file:` origin) with a plain `./fonts/`
 *  fallback for `electron-vite dev`, where the Vite server serves `public/`. */
export function injectFonts(): void {
  const css = FONTS.map((f) => {
    const enc = encodeURIComponent(f.file)
    return `@font-face{font-family:'${f.name}';src:url('userfont://f/${enc}'),url('./fonts/${enc}');font-display:swap;}`
  }).join('\n')
  const el = document.getElementById('caption-fonts') ?? document.createElement('style')
  el.id = 'caption-fonts'
  el.textContent = css
  if (!el.parentNode) document.head.appendChild(el)
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
