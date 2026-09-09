import type { CSSProperties } from 'react'
import type { CaptionBox, CaptionStyle, WordStyle } from '@shared/types'
import type { ActiveCaption } from '../lib/activeCaption'
import { DragBox } from './DragBox'

interface Props {
  caption: ActiveCaption
  style: CaptionStyle
  editable: boolean
  /** char range currently being restyled, if any */
  selectedRange?: { from: number; to: number } | null
  onBoxChange: (box: CaptionBox) => void
  onSeekToActive: () => void
  /** click a word — selects that word's char range for restyling */
  onWordClick?: (from: number, to: number) => void
}

function rgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity)).toFixed(2)})`
}

export function CaptionOverlay({
  caption,
  style,
  editable,
  selectedRange,
  onBoxChange,
  onSeekToActive,
  onWordClick,
}: Props) {
  if (caption.kind === 'none') return null

  const family =
    style.fontName === 'System' ? 'system-ui, sans-serif' : `'${style.fontName}', sans-serif`
  const showBg = style.background.enabled || style.preset === 'boxed'
  const strokeMul = showBg ? 0.25 : 1.6
  const strokeCqh = ((style.outline * strokeMul) / 1080 * 100).toFixed(2)
  const wordClicks = editable && !!onWordClick

  const flex: CSSProperties = {
    fontFamily: family,
    fontWeight: style.bold ? 800 : 500,
    fontSize: `${style.fontScale}cqh`,
    lineHeight: 1.2,
    textTransform: style.allCaps ? 'uppercase' : 'none',
    color: style.primaryColor,
    WebkitTextStroke: `${strokeCqh}cqh ${style.outlineColor || '#000'}`,
    paintOrder: 'stroke fill',
    display: 'inline-flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: '0.28em',
    rowGap: '0.06em',
    direction: caption.rtl ? 'rtl' : 'ltr',
  }
  const blockBg: CSSProperties = {
    display: 'inline-block',
    background: rgba(style.background.color, style.background.opacity),
    padding: '0.16em 0.36em',
    borderRadius: '0.16em',
    textAlign: 'center',
  }

  const karaoke = caption.kind === 'karaoke'
  const animKey =
    caption.kind === 'pop' ? caption.chunkKey : caption.kind === 'line' ? (caption.segId ?? 'x') : 'k'
  const animation =
    caption.kind === 'pop'
      ? 'cap-pop .2s cubic-bezier(.2,1.4,.4,1)'
      : caption.kind === 'line'
        ? 'cap-fade .18s ease-out'
        : undefined

  const fragStyle = (o: WordStyle | undefined): CSSProperties => {
    const s: CSSProperties = {}
    if (!o) return s
    if (o.color) s.color = o.color
    if (o.fontName) s.fontFamily = `'${o.fontName}', sans-serif`
    if (o.bold != null) s.fontWeight = o.bold ? 800 : 500
    if (o.allCaps != null) s.textTransform = o.allCaps ? 'uppercase' : 'none'
    if (o.sizePct != null) s.fontSize = `${((style.fontScale * o.sizePct) / 100).toFixed(2)}cqh`
    if (o.outline != null || o.outlineColor) {
      const sw = (o.outline ?? style.outline) * strokeMul
      s.WebkitTextStroke = `${((sw / 1080) * 100).toFixed(2)}cqh ${
        o.outlineColor || style.outlineColor || '#000'
      }`
    }
    return s
  }

  const inner = (
    <span key={animKey} style={{ ...flex, animation }}>
      {caption.words.map((w, i) => {
        const kColor =
          karaoke && 'spoken' in w && (w.spoken || w.active)
            ? style.accentColor
            : style.primaryColor
        const sel = selectedRange && selectedRange.to > w.from && selectedRange.from < w.to
        return (
          <span key={i} style={{ display: 'contents' }}>
            {w.br && <span style={{ flexBasis: '100%', height: 0 }} />}
            <span
              onPointerDown={
                wordClicks
                  ? (e) => {
                      e.stopPropagation()
                      onWordClick?.(w.from, w.to)
                    }
                  : undefined
              }
              style={{
                display: 'inline-block',
                whiteSpace: 'pre',
                color: kColor,
                cursor: wordClicks ? 'pointer' : undefined,
                borderRadius: '2px',
                outline: sel ? '2px solid #38bdf8' : undefined,
                outlineOffset: '1px',
                ...(karaoke && 'active' in w
                  ? {
                      transform: w.active ? 'scale(1.08)' : 'none',
                      transition: 'transform .12s ease-out, color .1s',
                    }
                  : {}),
              }}
            >
              {w.frags.map((f, fi) => (
                <span key={fi} style={{ display: 'inline-block', ...fragStyle(f.s) }}>
                  {f.text}
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )

  return (
    <DragBox
      box={caption.box}
      editable={editable}
      selected={editable}
      z={50}
      onBox={onBoxChange}
      onClick={caption.segId && caption.segId !== 'demo' ? onSeekToActive : undefined}
    >
      {showBg ? <div style={blockBg}>{inner}</div> : inner}
    </DragBox>
  )
}
