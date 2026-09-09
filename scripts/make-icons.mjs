// Rasterise build/icon.svg -> build/icon.png (1024) and derive icon.icns /
// icon.ico so electron-builder never has to guess. The dev window loads the
// PNG directly (see src/main/index.ts).
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import png2icons from 'png2icons'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'build', 'icon.svg')
const dir = join(root, 'build')

const svg = await readFile(src)
const png = await sharp(svg, { density: 384 }).resize(1024, 1024).png().toBuffer()
await writeFile(join(dir, 'icon.png'), png)

// createICNS(input, interpolation, numOfColors=0) ; createICO(input, interp, 0, dpi=false, allSizes=true)
const icns = png2icons.createICNS(png, png2icons.BICUBIC, 0)
const ico = png2icons.createICO(png, png2icons.BICUBIC, 0, false, true)
await writeFile(join(dir, 'icon.icns'), icns)
await writeFile(join(dir, 'icon.ico'), ico)

const kb = (b) => `${(b.length / 1024).toFixed(0)} KB`
console.log(`wrote icon.png (${kb(png)}), icon.icns (${kb(icns)}), icon.ico (${kb(ico)})`)
