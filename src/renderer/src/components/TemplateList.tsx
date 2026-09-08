import type { CSSProperties } from 'react'
import { CAPTION_TEMPLATES, applyTemplate, type CaptionTemplate } from '@shared/templates'
import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from '@shared/types'

function preview(t: CaptionTemplate): CSSProperties {
  const s: CaptionStyle = { ...DEFAULT_CAPTION_STYLE, ...t.patch }
  const family = s.fontName === 'System' ? 'system-ui, sans-serif' : `'${s.fontName}', sans-serif`
  const boxed = s.background.enabled
  return {
    fontFamily: family,
    fontWeight: s.bold ? 800 : 500,
    fontSize: '22px',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    textTransform: s.allCaps ? 'uppercase' : 'none',
    color: s.primaryColor,
    letterSpacing: '0.01em',
    ...(boxed
      ? {
          background: s.background.color,
          padding: '4px 10px',
          borderRadius: '6px',
        }
      : {
          WebkitTextStroke: `${Math.min(2, s.outline / 5).toFixed(1)}px #000`,
          paintOrder: 'stroke fill',
        }),
  }
}

export function TemplateList({
  style,
  onChange,
}: {
  style: CaptionStyle
  onChange: (next: CaptionStyle) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {CAPTION_TEMPLATES.map((t) => {
        const s: CaptionStyle = { ...DEFAULT_CAPTION_STYLE, ...t.patch }
        const active = style.templateId === t.id
        const accentWord =
          t.patch.preset === 'clean' || t.patch.background?.enabled ? null : s.accentColor
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(applyTemplate(style, t))}
            className={`w-full overflow-hidden rounded-xl border text-left transition ${
              active ? 'border-sky-500' : 'border-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex h-20 items-center justify-center overflow-hidden bg-slate-950/60 px-3">
              <span style={preview(t)}>
                make it{' '}
                <span style={accentWord ? { color: accentWord } : undefined}>pop</span>
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-900/70 px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-100">{t.name}</div>
                <div className="text-[11px] text-slate-500">{t.tag}</div>
              </div>
              <div className="flex gap-1">
                {[s.primaryColor, s.accentColor, s.background.enabled ? s.background.color : '#111827'].map(
                  (c, i) => (
                    <span
                      key={i}
                      className="h-4 w-4 rounded-sm border border-slate-700"
                      style={{ background: c }}
                    />
                  ),
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
