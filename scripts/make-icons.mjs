// Rasterise build/icon.svg -> build/icon.png (1024x1024).
// electron-builder derives the .icns / .ico from that PNG at package time,
// and the dev window loads the PNG directly (see src/main/index.ts).
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'build', 'icon.svg')
const out = join(root, 'build', 'icon.png')

const svg = await readFile(src)
const png = await sharp(svg, { density: 384 }).resize(1024, 1024).png().toBuffer()
await writeFile(out, png)
console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`)
