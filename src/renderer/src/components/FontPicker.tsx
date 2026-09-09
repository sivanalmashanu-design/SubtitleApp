import { useMemo, useState } from 'react'
import { FONTS } from '@shared/fonts'
import { loadFavFonts, toggleFavFont } from '../lib/prefs'

const ADD_FONT = '__addfont__'
const ORDER = ['Hebrew', 'Display', 'Sans', 'Rounded', 'Script', 'Serif']

interface Props {
  /** '' = inherit/(same) when allowInherit, 'System', or a family name */
  value: string
  onChange: (v: string) => void
  customFonts?: { family: string; file: string }[]
  onAddFont?: () => void
  disabled?: boolean
  /** show a "(same)" option that yields '' */
  allowInherit?: boolean
  /** show "System default" (default true) */
  allowSystem?: boolean
  compact?: boolean
}

export function FontPicker({
  value,
  onChange,
  customFonts = [],
  onAddFont,
  disabled,
  allowInherit,
  allowSystem = true,
  compact,
}: Props) {
  const [favFonts, setFavFonts] = useState<string[]>(() => loadFavFonts())
  const starrable = value && value !== 'System'
  const starred = favFonts.includes(value)

  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {}
    for (const f of FONTS) (g[f.category] ??= []).push(f.name)
    return ORDER.filter((k) => g[k]).map((k) => [k, g[k]] as const)
  }, [])

  return (
    <div className="flex gap-1.5">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ADD_FONT) onAddFont?.()
          else onChange(e.target.value)
        }}
        className={`flex-1 rounded bg-slate-800 text-slate-100 ${compact ? 'px-1 py-0.5 text-xs' : 'px-2 py-1.5'}`}
      >
        {allowInherit && <option value="">(same)</option>}
        {allowSystem && <option value="System">System default</option>}
        {favFonts.length > 0 && (
          <optgroup label="★ Favorites">
            {favFonts.map((n) => (
              <option key={`fav-${n}`} value={n}>
                {n}
              </option>
            ))}
          </optgroup>
        )}
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
        {onAddFont && <option value={ADD_FONT}>＋ Add font from computer…</option>}
      </select>
      <button
        type="button"
        disabled={disabled || !starrable}
        onClick={() => setFavFonts(toggleFavFont(value))}
        title={starred ? 'Remove from favorites' : 'Add to favorites'}
        className={`shrink-0 rounded ${compact ? 'px-1.5 text-sm' : 'px-2 text-base'} ${
          starred ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
        } disabled:opacity-30`}
      >
        {starred ? '★' : '☆'}
      </button>
    </div>
  )
}
