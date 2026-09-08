import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { Segment } from '@shared/types'
import { formatTimestamp } from '@shared/subtitles'

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

interface Props {
  segments: Segment[]
  activeId: string | null
  onChange: (segments: Segment[]) => void
  onSeek: (seconds: number) => void
  /** open the Style panel scoped to just this caption */
  onRestyle?: (id: string) => void
}

let nextId = 0
const freshId = () => `seg-new-${Date.now()}-${nextId++}`

export function TranscriptEditor({ segments, activeId, onChange, onSeek, onRestyle }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeId) return
    listRef.current
      ?.querySelector(`[data-id="${activeId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId])

  const patch = (id: string, next: Partial<Segment>) =>
    onChange(segments.map((s) => (s.id === id ? { ...s, ...next } : s)))

  const remove = (id: string) => onChange(segments.filter((s) => s.id !== id))

  const addAfter = (index: number) => {
    const prev = segments[index]
    const nextSeg = segments[index + 1]
    const start = prev ? prev.end : 0
    const end = nextSeg ? Math.max(start + 0.5, (start + nextSeg.start) / 2) : start + 2
    const insert: Segment = { id: freshId(), start, end, text: '' }
    onChange([...segments.slice(0, index + 1), insert, ...segments.slice(index + 1)])
  }

  /** Enter inside a line splits it into two captions at the cursor. */
  const splitAt = (index: number, caret: number): void => {
    const seg = segments[index]
    const before = seg.text.slice(0, caret).trim()
    const after = seg.text.slice(caret).trim()
    if (!before || !after) return
    const total = wordCount(seg.text) || 1
    const frac = Math.min(0.9, Math.max(0.1, wordCount(before) / total))
    const mid = seg.start + frac * (seg.end - seg.start)
    const a: Segment = { ...seg, end: mid, text: before }
    const b: Segment = { ...seg, id: freshId(), start: mid, text: after }
    onChange([...segments.slice(0, index), a, b, ...segments.slice(index + 1)])
  }

  const onKey = (index: number) => (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      splitAt(index, e.currentTarget.selectionStart)
    }
  }

  if (segments.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-slate-500">
        No lines yet. Run the transcription to fill this in.
      </p>
    )
  }

  return (
    <div ref={listRef} className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      <p className="px-1 text-[11px] text-slate-500">
        Enter splits a line into two captions at the cursor · Shift+Enter for a line break within one.
      </p>
      {segments.map((seg, i) => (
        <div
          key={seg.id}
          data-id={seg.id}
          className={`rounded-lg border p-2 transition ${
            seg.id === activeId ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/40'
          }`}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onSeek(seg.start)}
              className="font-mono text-sky-400 hover:underline"
              title="Jump to this line"
            >
              {formatTimestamp(seg.start, false).slice(0, 12)}
            </button>
            <input
              type="number"
              step={0.05}
              value={Number(seg.start.toFixed(2))}
              onChange={(e) => patch(seg.id, { start: Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded bg-slate-800 px-1 py-0.5 text-right"
            />
            <span>&rarr;</span>
            <input
              type="number"
              step={0.05}
              value={Number(seg.end.toFixed(2))}
              onChange={(e) => patch(seg.id, { end: Number(e.target.value) })}
              className="w-20 rounded bg-slate-800 px-1 py-0.5 text-right"
            />
            <div className="ml-auto flex items-center gap-1">
              {seg.styleOverride && (
                <button
                  type="button"
                  onClick={() => onRestyle?.(seg.id)}
                  className="rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-fuchsia-300 hover:bg-fuchsia-500/30"
                  title="This caption has its own style — click to edit it"
                >
                  🎨 style
                </button>
              )}
              {seg.box && (
                <button
                  type="button"
                  onClick={() => patch(seg.id, { box: null })}
                  className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-300 hover:bg-sky-500/30"
                  title="This line has a custom position — click to reset"
                >
                  📍 reset
                </button>
              )}
              <button
                type="button"
                onClick={() => addAfter(i)}
                className="rounded px-1.5 py-0.5 hover:bg-slate-700"
                title="Add line below"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => remove(seg.id)}
                className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-slate-700"
                title="Delete line"
              >
                &times;
              </button>
            </div>
          </div>
          <textarea
            value={seg.text}
            dir="auto"
            rows={Math.max(seg.text.split('\n').length, Math.ceil(seg.text.length / 60))}
            onChange={(e) => patch(seg.id, { text: e.target.value })}
            onKeyDown={onKey(i)}
            className="w-full resize-none rounded bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
            placeholder="(empty line)"
          />
        </div>
      ))}
    </div>
  )
}
