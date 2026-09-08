import {
  newTextOverlay,
  OVERLAY_ANIMATIONS,
  type OverlayAnimation,
  type TextOverlay,
} from '@shared/types'
import { FONT_OPTIONS } from '@shared/fonts'

interface Props {
  overlays: TextOverlay[]
  onChange: (next: TextOverlay[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  currentTime: number
  disabled?: boolean
}

export function OverlaysPanel({ overlays, onChange, selectedId, onSelect, currentTime, disabled }: Props) {
  const patch = (id: string, p: Partial<TextOverlay>): void =>
    onChange(overlays.map((o) => (o.id === id ? { ...o, ...p } : o)))
  const patchBg = (id: string, p: Partial<TextOverlay['background']>): void => {
    const o = overlays.find((x) => x.id === id)
    if (o) patch(id, { background: { ...o.background, ...p } })
  }
  const remove = (id: string): void => {
    onChange(overlays.filter((o) => o.id !== id))
    if (selectedId === id) onSelect(null)
  }
  const add = (): void => {
    const o = newTextOverlay(currentTime)
    onChange([...overlays, o])
    onSelect(o.id)
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {overlays.length === 0 && (
        <p className="text-xs text-slate-500">
          Add a title, hook or call-to-action that isn&rsquo;t part of the spoken transcript.
        </p>
      )}
      {overlays.map((o) => (
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
              onChange={(e) => patch(o.id, { text: e.target.value })}
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
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={add}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        + Add text card
      </button>
      {selectedId && (
        <p className="text-xs text-sky-300">Drag the highlighted box on the video to place it.</p>
      )}
    </div>
  )
}
