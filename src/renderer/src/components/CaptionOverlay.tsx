import type { CSSProperties, ReactNode } from 'react'
import type { CaptionBox, CaptionStyle } from '@shared/types'
import type { ActiveCaption } from '../lib/activeCaption'
import { DragBox } from './DragBox'

interface Props {
  caption: ActiveCaption
  style: CaptionStyle
  editable: boolean
  onBoxChange: (box: CaptionBox) => void
  onSeekToActive: () => void
}

function rgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity)).toFixed(2)})`
}

export function CaptionOverlay({ caption, style, editable, onBoxChange, onSeekToActive }: Props) {
  // nothing playing at this time -> draw nothing (no faded placeholder box)
  if (caption.kind === 'none') return null

  const family =
    style.fontName === 'System' ? 'system-ui, sans-serif' : `'${style.fontName}', sans-serif`
  const showBg = style.background.enabled || style.preset === 'boxed'
  // libass Outline sits fully OUTSIDE the glyph; -webkit-text-stroke is centred on
  // the path, so ~1.6x roughly matches the burned weight. With a background block
  // the export only uses a thin legibility outline.
  const strokeW = showBg ? style.outline * 0.25 : style.outline * 1.6
  const strokeCqh = ((strokeW / 1080) * 100).toFixed(2)

  const base: CSSProperties = {
    fontFamily: family,
    fontWeight: style.bold ? 800 : 500,
    fontSize: `${style.fontScale}cqh`,
    lineHeight: 1.2,
    textTransform: style.allCaps ? 'uppercase' : 'none',
    color: style.primaryColor,
    whiteSpace: 'pre-line',
  }
  // one smooth rounded rect behind the whole block — mirrors buildAss's \p1 draw
  const boxDeco: CSSProperties = { WebkitTextStroke: `${strokeCqh}cqh #000`, paintOrder: 'stroke fill' }
  const blockBg: CSSProperties = {
    display: 'inline-block',
    background: rgba(style.background.color, style.background.opacity),
    padding: '0.16em 0.36em',
    borderRadius: '0.16em',
    textAlign: 'center',
  }

  let inner: ReactNode
  if (caption.kind === 'karaoke') {
    inner = (
      <span
        style={{
          ...base,
          ...boxDeco,
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: '0.28em',
          rowGap: '0.06em',
          direction: caption.rtl ? 'rtl' : 'ltr',
        }}
      >
        {caption.words.map((w, i) => (
          <span key={i} style={{ display: 'contents' }}>
            {w.br && <span style={{ flexBasis: '100%', height: 0 }} />}
            <span
              style={{
                color: w.spoken || w.active ? style.accentColor : style.primaryColor,
                transform: w.active ? 'scale(1.08)' : 'none',
                transition: 'transform .12s ease-out, color .1s',
                display: 'inline-block',
              }}
            >
              {w.text}
            </span>
          </span>
        ))}
      </span>
    )
  } else if (caption.kind === 'pop') {
    inner = (
      <span
        key={caption.chunkKey}
        style={{ ...base, ...boxDeco, direction: caption.rtl ? 'rtl' : 'ltr', animation: 'cap-pop .2s cubic-bezier(.2,1.4,.4,1)' }}
      >
        {caption.text}
      </span>
    )
  } else {
    inner = (
      <span
        key={caption.segId ?? 'x'}
        style={{ ...base, ...boxDeco, direction: caption.rtl ? 'rtl' : 'ltr', animation: 'cap-fade .18s ease-out' }}
      >
        {caption.text}
      </span>
    )
  }

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
