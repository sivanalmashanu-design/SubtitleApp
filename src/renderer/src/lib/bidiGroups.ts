import { isRtl } from '@shared/ass'

/**
 * The preview lays words out as separate flex items. In an RTL caption that
 * makes the browser order *every* item right-to-left, so a run of English words
 * ("Apple iPhone") comes out reversed ("iPhone Apple") — libass, which runs the
 * real bidi algorithm on the whole line, keeps it left-to-right.
 *
 * `bidiGroups` rebuilds that behaviour: consecutive left-to-right words on a
 * line are bundled into one group, to be drawn as a single LTR box that is
 * itself placed right-to-left among the Hebrew words.
 */
export interface BidiGroup<T> {
  /** an LTR run (render the items inside one `direction: ltr` box) */
  ltr: boolean
  items: T[]
}

type Cls = 'L' | 'R' | 'N'

const classify = (s: string): Cls =>
  isRtl(s) ? 'R' : /[\p{L}\p{N}]/u.test(s) ? 'L' : 'N'

export function bidiGroups<T>(
  items: T[],
  textOf: (t: T) => string,
  startsLine: (t: T, i: number) => boolean,
  rtl: boolean,
): BidiGroup<T>[] {
  // a left-to-right caption needs no special handling
  if (!rtl) return items.map((t) => ({ ltr: false, items: [t] }))

  // split into lines (a word flagged as a line start begins a new one)
  const lines: T[][] = []
  items.forEach((t, i) => {
    if (i === 0 || startsLine(t, i)) lines.push([])
    lines[lines.length - 1].push(t)
  })

  const out: BidiGroup<T>[] = []
  for (const line of lines) {
    const cls = line.map((t) => classify(textOf(t)))
    // neutral-only words (" - ", "&") sit inside an LTR run when both
    // neighbours are LTR, otherwise they follow the caption's RTL direction
    for (let i = 0; i < cls.length; i++) {
      if (cls[i] !== 'N') continue
      let p = i - 1
      while (p >= 0 && cls[p] === 'N') p--
      let n = i + 1
      while (n < cls.length && cls[n] === 'N') n++
      cls[i] = p >= 0 && n < cls.length && cls[p] === 'L' && cls[n] === 'L' ? 'L' : 'R'
    }
    let cur: BidiGroup<T> | null = null
    line.forEach((t, i) => {
      if (cls[i] === 'L') {
        if (!cur) {
          cur = { ltr: true, items: [] }
          out.push(cur)
        }
        cur.items.push(t)
      } else {
        cur = null
        out.push({ ltr: false, items: [t] })
      }
    })
  }
  return out
}
