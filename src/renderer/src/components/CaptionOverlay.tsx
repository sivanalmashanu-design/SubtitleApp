import type { CSSProperties } from 'react'
import type { CaptionBox, CaptionStyle } from '@shared/types'
import type { ActiveCaption } from '../lib/activeCaption'
import { DragBox } from './DragBox'

interface Props {
  caption: ActiveCaption
  style: CaptionStyle
  editable: boolean
  /** word index (wi) currently being restyled, if any */
  selectedWord?: number | null
  onBoxChange: (box: CaptionBox) => void
  onSeekToActive: () => void
  /** click a word to restyle just that word */
  onWordClick?: (wi: number) => void
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
  selectedWord,
  onBoxChange,
  onSeekToActive,
  onWordClick,
}: Props) {
  if (caption.kind === 'none') return null

  const family =
    style.fontName === 'System' ? 'system-ui, sans-serif' : `'${style.fontName}', sans-serif`
  const showBg = style.background.enabled || style.preset === 'boxed'
  const strokeW = showBg ? style.outline * 0.25 : style.outline * 1.6
  const strokeCqh = ((strokeW / 1080) * 100).toFixed(2)
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

  const inner = (
    <span key={animKey} style={{ ...flex, animation }}>
      {caption.words.map((w, i) => {
        const wc = w as typeof w & { color?: string; fontName?: string }
        const kColor =
          karaoke && 'spoken' in w
            ? w.spoken || w.active
              ? style.accentColor
              : style.primaryColor
            : style.primaryColor
        return (
          <span key={i} style={{ display: 'contents' }}>
            {w.br && <span style={{ flexBasis: '100%', height: 0 }} />}
            <span
              onPointerDown={
                wordClicks
                  ? (e) => {
                      e.stopPropagation()
                      onWordClick?.(w.wi)
                    }
                  : undefined
              }
              style={{
                display: 'inline-block',
                color: wc.color || kColor,
                fontFamily: wc.fontName ? `'${wc.fontName}', sans-serif` : undefined,
                cursor: wordClicks ? 'pointer' : undefined,
                borderRadius: '2px',
                outline: selectedWord === w.wi ? '2px solid #38bdf8' : undefined,
                outlineOffset: '1px',
                ...(karaoke && 'active' in w
                  ? {
                      transform: w.active ? 'scale(1.08)' : 'none',
                      transition: 'transform .12s ease-out, color .1s',
                    }
                  : {}),
              }}
            >
              {w.text}
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
