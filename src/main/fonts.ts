import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { type BrowserWindow, dialog } from 'electron'
import { bundledFontsDir, fontsDir } from './paths'

export interface CustomFont {
  family: string
  file: string
}

const manifest = (): string => join(fontsDir(), 'custom.json')

/** Copy the bundled fonts into the writable fonts dir (once). */
export async function ensureFonts(): Promise<void> {
  const dir = fontsDir()
  await mkdir(dir, { recursive: true })
  try {
    for (const f of await readdir(bundledFontsDir())) {
      if (!/\.(ttf|otf)$/i.test(f)) continue
      const dest = join(dir, f)
      if (!existsSync(dest)) await copyFile(join(bundledFontsDir(), f), dest)
    }
  } catch {
    /* no bundled fonts */
  }
}

export async function listCustomFonts(): Promise<CustomFont[]> {
  try {
    const arr = JSON.parse(await readFile(manifest(), 'utf8')) as CustomFont[]
    return arr.filter((c) => existsSync(join(fontsDir(), c.file)))
  } catch {
    return []
  }
}

export async function addCustomFonts(win: BrowserWindow | undefined): Promise<CustomFont[]> {
  const res = win
    ? await dialog.showOpenDialog(win, openOpts())
    : await dialog.showOpenDialog(openOpts())
  if (res.canceled) return listCustomFonts()

  const list = await listCustomFonts()
  for (const src of res.filePaths) {
    try {
      const buf = await readFile(src)
      const family = readFontFamily(buf) || basename(src, extname(src))
      const file = `${family.replace(/[^\w \-()]/g, '_')}${extname(src).toLowerCase()}`
      await copyFile(src, join(fontsDir(), file))
      if (!list.some((c) => c.family === family)) list.push({ family, file })
    } catch {
      /* skip unreadable file */
    }
  }
  await writeFile(manifest(), JSON.stringify(list, null, 2))
  return list
}

function openOpts(): Electron.OpenDialogOptions {
  return {
    title: 'Add a font',
    filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'ttc'] }],
    properties: ['openFile', 'multiSelections'],
  }
}

/** Pull the family name out of a TrueType/OpenType `name` table. */
function readFontFamily(buf: Buffer): string | null {
  try {
    let base = 0
    if (buf.toString('ascii', 0, 4) === 'ttcf') base = buf.readUInt32BE(12)
    const numTables = buf.readUInt16BE(base + 4)
    let nameOff = 0
    for (let i = 0; i < numTables; i++) {
      const rec = base + 12 + i * 16
      if (buf.toString('ascii', rec, rec + 4) === 'name') {
        nameOff = buf.readUInt32BE(rec + 8)
        break
      }
    }
    if (!nameOff) return null
    const count = buf.readUInt16BE(nameOff + 2)
    const strOff = nameOff + buf.readUInt16BE(nameOff + 4)
    let typographic: string | null = null
    let family: string | null = null
    for (let i = 0; i < count; i++) {
      const rec = nameOff + 6 + i * 12
      const platform = buf.readUInt16BE(rec)
      const nameId = buf.readUInt16BE(rec + 6)
      const len = buf.readUInt16BE(rec + 8)
      const off = strOff + buf.readUInt16BE(rec + 10)
      if (nameId !== 1 && nameId !== 16) continue
      let s = ''
      if (platform === 3 || platform === 0) {
        for (let j = 0; j + 1 < len; j += 2) s += String.fromCharCode(buf.readUInt16BE(off + j))
      } else {
        s = buf.toString('latin1', off, off + len)
      }
      s = s.replace(/\p{Cc}/gu, '').trim()
      if (!s) continue
      if (nameId === 16) typographic = s
      else if (nameId === 1 && !family) family = s
    }
    return typographic || family
  } catch {
    return null
  }
}
