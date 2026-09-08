import { useMemo } from 'react'
import type { CaptionStyle } from '@shared/types'
import { FONTS } from '@shared/fonts'

const ADD_FONT = '__addfont__'

interface Props {
  section: 'text' | 'breaks'
  style: CaptionStyle
  onChange: (next: CaptionStyle) => void
  disabled?: boolean
  delaySec: number
  onDelay: (s: number) => void
  customFonts?: { family: string; file: string }[]
  onAddFont?: () => void
}

export function CaptionControls({
  section,
  style,
  onChange,
  disabled,
  delaySec,
  onDelay,
  customFonts = [],
  onAddFont,
}: Props) {
  const set = <K extends keyof CaptionStyle>(key: K, value: CaptionStyle[K]): void =>
    onChange({ ...style, [key]: value })
  const setBox = (patch: Partial<CaptionStyle['box']>): void =>
    onChange({ ...style, box: { ...style.box, ...patch } })
  const setBg = (patch: Partial<CaptionStyle['background']>): void =>
    onChange({ ...style, background: { ...style.background, ...patch } })

  const grouped = useMemo(() => {
    const order = ['Hebrew', 'Display', 'Sans', 'Rounded', 'Script', 'Serif']
    const g: Record<string, string[]> = {}
    for (const f of FONTS) (g[f.category] ??= []).push(f.name)
    return order.filter((k) => g[k]).map((k) => [k, g[k]] as const)
  }, [])

  if (section === 'text') {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Font</span>
          <select
            value={style.fontName}
            disabled={disabled}
            onChange={(e) => {
              if (e.target.value === ADD_FONT) onAddFont?.()
              else set('fontName', e.target.value)
            }}
            className="rounded bg-slate-800 px-2 py-1.5"
          >
            <option value="System">System default</option>
            {grouped.map(([cat, names]) => (
              <optgroup key={cat} label={cat === 'Hebrew' ? 'Hebrew ✓' : cat}>
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </optgroup>
            ))}
            {customFonts.length > 0 && (
              <optgroup label="Imported">
                {customFonts.map((f) => (
                  <option key={f.file} value={f.family}>
                    {f.family}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={ADD_FONT}>＋ Add font from computer…</option>
          </select>
          <span className="text-[11px] text-slate-500">
            The “Hebrew” group has Hebrew letters — other fonts fall back to the system font for Hebrew.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Size ({style.fontScale.toFixed(2)}%)</span>
            <input
              type="range"
              min={2}
              max={14}
              step={0.25}
              value={style.fontScale}
              disabled={disabled}
              onChange={(e) => set('fontScale', Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">
              Outline ({style.outline}
              {style.background.enabled ? ' · off with block' : ''})
            </span>
            <input
              type="range"
              min={0}
              max={16}
              value={style.outline}
              disabled={disabled || style.background.enabled}
              onChange={(e) => set('outline', Number(e.target.value))}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Text</span>
            <input
              type="color"
              value={style.primaryColor}
              disabled={disabled}
              onChange={(e) => set('primaryColor', e.target.value)}
              className="h-8 w-12 rounded border border-slate-700 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Highlight</span>
            <input
              type="color"
              value={style.accentColor}
              disabled={disabled}
              onChange={(e) => set('accentColor', e.target.value)}
              className="h-8 w-12 rounded border border-slate-700 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={style.allCaps}
              disabled={disabled}
              onChange={(e) => set('allCaps', e.target.checked)}
            />
            <span className="text-slate-400">ALL CAPS</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={style.bold}
              disabled={disabled}
              onChange={(e) => set('bold', e.target.checked)}
            />
            <span className="text-slate-400">Bold</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={style.background.enabled}
              disabled={disabled}
              onChange={(e) => setBg({ enabled: e.target.checked })}
            />
            <span className="text-slate-300">Background block</span>
          </label>
          <input
            type="color"
            value={style.background.color}
            disabled={disabled || !style.background.enabled}
            onChange={(e) => setBg({ color: e.target.value })}
            className="h-8 w-12 rounded border border-slate-700 bg-transparent disabled:opacity-40"
          />
          <label className="flex flex-1 items-center gap-2">
            <span className="text-slate-400">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={style.background.opacity}
              disabled={disabled || !style.background.enabled}
              onChange={(e) => setBg({ opacity: Number(e.target.value) })}
              className="flex-1"
            />
          </label>
        </div>
      </div>
    )
  }

  // section === 'breaks'
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <span className="text-slate-400">Lines on screen (word-by-word)</span>
        <div className="flex overflow-hidden rounded-lg border border-slate-700">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => set('linesOnScreen', n)}
              className={`flex-1 py-1.5 ${
                style.linesOnScreen === n ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          Fewer lines + bigger text = fewer words per screen.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Box width ({Math.round(style.box.widthPct)}%)</span>
          <input
            type="range"
            min={20}
            max={96}
            value={style.box.widthPct}
            disabled={disabled}
            onChange={(e) => setBox({ widthPct: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Box height ({Math.round(style.box.heightPct)}%)</span>
          <input
            type="range"
            min={6}
            max={70}
            value={style.box.heightPct}
            disabled={disabled}
            onChange={(e) => setBox({ heightPct: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-400">Position</span>
        {(
          [
            ['Top', 12],
            ['Middle', 50],
            ['Lower', 82],
          ] as const
        ).map(([label, y]) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => setBox({ xPct: 50, yPct: y })}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Drag the box on the video to move it. Use the <b>All captions / This caption</b> switch above
        to apply changes globally or to just the caption playing now.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-slate-400">
          Delay all captions ({delaySec > 0 ? '+' : ''}
          {delaySec.toFixed(1)}s)
        </span>
        <input
          type="range"
          min={-3}
          max={3}
          step={0.1}
          value={delaySec}
          disabled={disabled}
          onChange={(e) => onDelay(Number(e.target.value))}
        />
      </label>
    </div>
  )
}
