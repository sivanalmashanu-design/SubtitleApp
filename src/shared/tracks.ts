/**
 * Greedy row assignment for time ranges: each item gets the lowest row index
 * whose previous item has already ended. Overlapping items stack onto separate
 * rows. Row 0 is the top "channel" and, by convention, the highest render layer.
 */
export function packRows(
  items: { id: string; start: number; end: number }[],
): Map<string, number> {
  const rowEnds: number[] = []
  const out = new Map<string, number>()
  for (const it of [...items].sort((a, b) => a.start - b.start)) {
    let r = rowEnds.findIndex((end) => end <= it.start + 1e-3)
    if (r === -1) {
      r = rowEnds.length
      rowEnds.push(0)
    }
    rowEnds[r] = it.end
    out.set(it.id, r)
  }
  return out
}
