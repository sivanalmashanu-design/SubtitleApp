import { useState } from 'react'
import {
  newTextOverlay,
  OVERLAY_ANIMATIONS,
  type OverlayAnimation,
  type TextOverlay,
  type WordStyle,
} from '@shared/types'
import { editRuns, normText, rangeStyle, rawToNorm } from '@shared/runs'
import { FONT_OPTIONS } from '@shared/fonts'
import { FontPicker } from './FontPicker'

interface Props {
  overlays: TextOverlay[]
  onChange: (next: TextOverlay[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  currentTime: number
  disabled?: boolean
  customFonts?: { family: string; file: string }[]
  onAddFont?: () => void
}

export function OverlaysPanel({
  overlays,
  onChange,
  selectedId,
  onSelect,
  currentTime,
  disabled,
  customFonts = [],
  onAddFont,
}: Props) {
  const [rng, setRng] = useState<{ id: string; from: number; to: number; label: string } | null>(
    null,
  )

  const patch = (id: string, p: Partial<TextOverlay>): void =>
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...p } : o)))
  const patchBg = (id: string, p: Partial<TextOverlay['background']>): void => {
    const o = overlays.find((x) => x.id === id)
    if (o) patch(id, { background: { ...o.background, ...p } })
  }
  const remove = (id: string): void => {
    onChange(overlays.filter((o) => o.id !== id))
    if (selectedId === id) onSelect(null)
    if (rng?.id === id) setRng(null)
  }
  const add = (): void => {
    const o = newTextOverlay(currentTime)
    onChange([...overlays, o])
    onSelect(o.id)
  }

  const onTextSelect = (o: TextOverlay) => (e: {
    currentTarget: HTMLInputElement
  }): void => {
    const el = e.currentTarget
    const a = el.selectionStart ?? 0
    const b = el.selectionEnd ?? 0
    if (b > a) {
      const from = rawToNorm(o.text, a)
      const to = rawToNorm(o.text, b)
      if (to > from) {
        setRng({ id: o.id, from, to, label: normText(o.text).slice(from, to) })
        return
      }
    }
    setRng((r) => (r && r.id === o.id ? null : r))
  }

  /** merge `p` into the active range on card `id` (null clears every field) */
  const setRangeStyle = (id: string, p: Partial<WordStyle> | null): void => {
    if (!rng || rng.id !== id) return
    const o = overlays.find((x) => x.id === id)
    if (!o) return
    const len = Math.max(normText(o.text).length, rng.to)
    const next = editRuns(o.runs ?? [], len, rng.from, rng.to, p === null ? null : p)
    patch(id, { runs: next.length ? next : undefined })
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {overlays.length === 0 && (
        <p className="text-xs text-slate-500">
          Add a title, hook or call-to-action that isn&rsquo;t part of the spoken transcript.
        </p>
      )}
      {overlays.map((o) => {
        const rstyle =
          rng?.id === o.id ? rangeStyle(o.runs ?? [], rng.from, rng.to) : null
        return (
          <div
            key={o.id}
            className={`rounded-lg border p-2 ${
              selectedId === o.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/40'
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <input
                value={o.text}
                dir="auto"
                disabled={disabled}
                onChange={(e) => {
                  patch(o.id, { text: e.target.value })
                  if (rng?.id === o.id) setRng(null)
                }}
                onSelect={onTextSelect(o)}
                className="flex-1 rounded bg-slate-800 px-2 py-1 text-slate-100"
                placeholder="Card text"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(selectedId === o.id ? null : o.id)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                {selectedId === o.id ? 'Editing…' : 'Place'}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(o.id)}
                className="rounded px-1.5 py-1 text-rose-400 hover:bg-slate-800"
              >
                ×
              </button>
            </div>

            {rng?.id === o.id && rstyle && (
              <div className="mb-2 flex flex-col gap-2 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 p-2 text-xs text-fuchsia-100">
                <div className="flex items-center justify-between">
                  <span className="min-w-0 truncate font-medium">
                    Styling:{' '}
                    <b>“{rng.label.length > 28 ? `${rng.label.slice(0, 28)}…` : rng.label}”</b>
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRangeStyle(o.id, null)}
                      className="rounded bg-slate-700 px-2 py-0.5 hover:bg-slate-600"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setRng(null)}
                      className="rounded px-1.5 text-fuchsia-300 hover:bg-fuchsia-500/20"
                    >
                      Done
                    </button>
                  </div>
                </div>
                <label className="flex flex-col gap-1">
                  <span>Font</span>
                  <FontPicker
                    value={rstyle.fontName || ''}
                    onChange={(v) => setRangeStyle(o.id, { fontName: v || undefined })}
                    customFonts={customFonts}
                    onAddFont={onAddFont}
                    disabled={disabled}
                    allowInherit
                    allowSystem={false}
                    compact
                  />
                </label>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="flex items-center gap-1">
                    Color
                    <input
                      type="color"
                      value={rstyle.color || o.color}
                      onChange={(e) => setRangeStyle(o.id, { color: e.target.value })}
                      className="h-7 w-9 rounded border border-slate-700 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Size
                    <input
                      type="range"
                      min={40}
                      max={220}
                      step={5}
                      value={rstyle.sizePct ?? 100}
                      onChange={(e) =>
                        setRangeStyle(o.id, {
                          sizePct:
                            Number(e.target.value) === 100 ? undefined : Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                    <span className="w-9 tabular-nums">{rstyle.sizePct ?? 100}%</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={rstyle.bold ?? o.bold}
                      onChange={(e) =>
                        setRangeStyle(o.id, {
                          bold: e.target.checked === o.bold ? undefined : e.target.checked,
                        })
                      }
                    />
                    Bold
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={rstyle.allCaps ?? o.allCaps}
                      onChange={(e) =>
                        setRangeStyle(o.id, {
                          allCaps: e.target.checked === o.allCaps ? undefined : e.target.checked,
                        })
                      }
                    />
                    CAPS
                  </label>
                  <label className="flex items-center gap-1">
                    Outline
                    <input
                      type="range"
                      min={0}
                      max={16}
                      value={rstyle.outline ?? o.outline}
                      onChange={(e) =>
                        setRangeStyle(o.id, {
                          outline:
                            Number(e.target.value) === o.outline
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      className="w-20"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    Outline color
                    <input
                      type="color"
                      value={rstyle.outlineColor || '#000000'}
                      onChange={(e) => setRangeStyle(o.id, { outlineColor: e.target.value })}
                      className="h-7 w-9 rounded border border-slate-700 bg-transparent"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>from</span>
              <input
                type="number"
                step={0.1}
                value={Number(o.start.toFixed(1))}
                disabled={disabled}
                onChange={(e) => patch(o.id, { start: Math.max(0, Number(e.target.value)) })}
                className="w-16 rounded bg-slate-800 px-1 py-0.5 text-right"
              />
              <span>to</span>
              <input
                type="number"
                step={0.1}
                value={Number(o.end.toFixed(1))}
                disabled={disabled}
                onChange={(e) => patch(o.id, { end: Number(e.target.value) })}
                className="w-16 rounded bg-slate-800 px-1 py-0.5 text-right"
              />
              <select
                value={o.animation}
                disabled={disabled}
                onChange={(e) => patch(o.id, { animation: e.target.value as OverlayAnimation })}
                className="rounded bg-slate-800 px-1 py-0.5"
              >
                {OVERLAY_ANIMATIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1">
                <input
                  type="color"
                  value={o.color}
                  disabled={disabled}
                  onChange={(e) => patch(o.id, { color: e.target.value })}
                  className="h-6 w-8 rounded border border-slate-700 bg-transparent"
                />
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={o.allCaps}
                  disabled={disabled}
                  onChange={(e) => patch(o.id, { allCaps: e.target.checked })}
                />
                CAPS
              </label>
            </div>

            <details className="mt-1 text-xs text-slate-400">
              <summary className="cursor-pointer select-none">Font &amp; effects</summary>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <span className="w-16">Font</span>
                  <select
                    value={FONT_OPTIONS.includes(o.fontName) ? o.fontName : 'System'}
                    disabled={disabled}
                    onChange={(e) => patch(o.id, { fontName: e.target.value })}
                    className="flex-1 rounded bg-slate-800 px-1 py-0.5"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-16">Size</span>
                  <input
                    type="range"
                    min={3}
                    max={16}
                    step={0.5}
                    value={o.fontScale}
                    disabled={disabled}
                    onChange={(e) => patch(o.id, { fontScale: Number(e.target.value) })}
                    className="flex-1"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-16">Outline</span>
                  <input
                    type="range"
                    min={0}
                    max={14}
                    value={o.outline}
                    disabled={disabled || o.background.enabled}
                    onChange={(e) => patch(o.id, { outline: Number(e.target.value) })}
                    className="flex-1"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={o.background.enabled}
                      disabled={disabled}
                      onChange={(e) => patchBg(o.id, { enabled: e.target.checked })}
                    />
                    Background
                  </label>
                  <input
                    type="color"
                    value={o.background.color}
                    disabled={disabled || !o.background.enabled}
                    onChange={(e) => patchBg(o.id, { color: e.target.value })}
                    className="h-6 w-8 rounded border border-slate-700 bg-transparent disabled:opacity-40"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={o.background.opacity}
                    disabled={disabled || !o.background.enabled}
                    onChange={(e) => patchBg(o.id, { opacity: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={o.bold}
                      disabled={disabled}
                      onChange={(e) => patch(o.id, { bold: e.target.checked })}
                    />
                    Bold
                  </label>
                </div>
              </div>
            </details>
          </div>
        )
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={add}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        + Add text card
      </button>
      <p className="text-xs text-slate-500">
        Select part of a card&rsquo;s text above to give just that bit its own font, colour, size or
        outline.
      </p>
      {selectedId && (
        <p className="text-xs text-sky-300">Drag the highlighted box on the video to place it.</p>
      )}
    </div>
  )
}
