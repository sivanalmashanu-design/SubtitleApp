import { useCallback, useEffect, useReducer, useRef } from 'react'

/**
 * Debounced undo/redo over an arbitrary document value.
 *
 * Pass a value that changes identity whenever the document changes (a memoised
 * `{ ...parts }` object) plus an `apply` that writes a snapshot back into your
 * state. Rapid changes (dragging a slider) coalesce into one history entry.
 * Changes caused by `apply` itself are not re-recorded, because `apply` moves
 * the internal baseline in the same tick.
 */
export function useUndoRedo<T>(
  value: T,
  apply: (snapshot: T) => void,
  opts: { resetKey: string; delay?: number; limit?: number } = { resetKey: '' },
): { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } {
  const { resetKey, delay = 450, limit = 50 } = opts
  const [, bump] = useReducer((n: number) => n + 1, 0)

  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  const base = useRef<T>(value) // last committed snapshot
  const valueRef = useRef<T>(value)
  valueRef.current = value
  const keyRef = useRef(resetKey)

  const eq = (a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b)
  const clone = (v: T): T =>
    typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))

  // new document (project switch) — drop history, adopt current as baseline
  useEffect(() => {
    if (keyRef.current === resetKey) return
    keyRef.current = resetKey
    past.current = []
    future.current = []
    base.current = valueRef.current
    bump()
  }, [resetKey])

  // record edits, debounced (coalesces bursts into one entry)
  useEffect(() => {
    if (eq(value, base.current)) return
    const id = setTimeout(() => {
      if (eq(valueRef.current, base.current)) return
      past.current.push(clone(base.current))
      if (past.current.length > limit) past.current.shift()
      future.current = []
      base.current = clone(valueRef.current)
      bump()
    }, delay)
    return () => clearTimeout(id)
  }, [value, delay, limit])

  const commit = useCallback(
    (snap: T) => {
      base.current = clone(snap)
      apply(snap)
      bump()
    },
    [apply],
  )

  const undo = useCallback(() => {
    // an edit made in the last <delay> ms isn't in `past` yet — undo it directly
    if (!eq(valueRef.current, base.current)) {
      future.current.push(clone(valueRef.current))
      commit(base.current)
      return
    }
    if (past.current.length === 0) return
    future.current.push(clone(base.current))
    commit(past.current.pop() as T)
  }, [commit])

  const redo = useCallback(() => {
    // a fresh (uncommitted) edit supersedes the redo stack
    if (future.current.length === 0 || !eq(valueRef.current, base.current)) return
    past.current.push(clone(base.current))
    commit(future.current.pop() as T)
  }, [commit])

  return {
    undo,
    redo,
    canUndo: past.current.length > 0 || !eq(valueRef.current, base.current),
    canRedo: future.current.length > 0,
  }
}
