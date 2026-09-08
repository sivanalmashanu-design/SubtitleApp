import { useCallback, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import type { CaptionBox } from '@shared/types'

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

type Mode = 'move' | 'left' | 'right' | 'bottom'

interface Props {
  box: CaptionBox
  editable: boolean
  selected?: boolean
  /** stacking order — higher renders on top */
  z?: number
  onBox: (b: CaptionBox) => void
  onSelect?: () => void
  /** fired on a click (press with no meaningful drag) */
  onClick?: () => void
  children: ReactNode
}

export function DragBox({ box, editable, selected, z, onBox, onSelect, onClick, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: Mode; sx: number; sy: number; box: CaptionBox; moved: number } | null>(null)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  const parentRect = (): DOMRect | null =>
    rootRef.current?.parentElement?.getBoundingClientRect() ?? null

  const onMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const d = drag.current
      const r = parentRect()
      if (!d || !r) return
      d.moved = Math.max(d.moved, Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy))
      const dx = ((e.clientX - d.sx) / r.width) * 100
      const dy = ((e.clientY - d.sy) / r.height) * 100
      if (d.mode === 'move') {
        onBox({ ...d.box, xPct: clamp(d.box.xPct + dx, 2, 98), yPct: clamp(d.box.yPct + dy, 2, 98) })
      } else if (d.mode === 'left') {
        onBox({ ...d.box, widthPct: clamp(d.box.widthPct - dx * 2, 12, 96) })
      } else if (d.mode === 'right') {
        onBox({ ...d.box, widthPct: clamp(d.box.widthPct + dx * 2, 12, 96) })
      } else {
        onBox({ ...d.box, heightPct: clamp(d.box.heightPct + dy * 2, 5, 90) })
      }
    },
    [onBox],
  )

  const onUp = useCallback(() => {
    const d = drag.current
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    if (d && d.mode === 'move' && d.moved < 5) onClickRef.current?.()
  }, [onMove])

  const begin = (mode: Mode) => (e: PointerEvent) => {
    e.stopPropagation()
    if (!editable) {
      if (mode === 'move' && onClickRef.current) onClickRef.current()
      return
    }
    e.preventDefault()
    onSelect?.()
    drag.current = { mode, sx: e.clientX, sy: e.clientY, box: { ...box }, moved: 0 }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const wrapStyle: CSSProperties = {
    position: 'absolute',
    zIndex: z,
    left: `${box.xPct}%`,
    top: `${box.yPct}%`,
    width: `${box.widthPct}%`,
    height: editable ? `${box.heightPct}%` : undefined,
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    touchAction: 'none',
    cursor: editable ? 'move' : 'pointer',
    outline: editable
      ? selected
        ? '2px solid #38bdf8'
        : '1px dashed rgba(125,211,252,0.55)'
      : 'none',
    outlineOffset: '4px',
  }

  const handle = (s: CSSProperties): CSSProperties => ({
    position: 'absolute',
    borderRadius: '3px',
    background: 'rgba(56,189,248,0.95)',
    ...s,
  })

  return (
    <div ref={rootRef} style={wrapStyle} onPointerDown={begin('move')}>
      {children}
      {editable && (
        <>
          <div style={handle({ top: '50%', left: '-11px', width: '9px', height: '30px', marginTop: '-15px', cursor: 'ew-resize' })} onPointerDown={begin('left')} />
          <div style={handle({ top: '50%', right: '-11px', width: '9px', height: '30px', marginTop: '-15px', cursor: 'ew-resize' })} onPointerDown={begin('right')} />
          <div style={handle({ left: '50%', bottom: '-11px', width: '30px', height: '9px', marginLeft: '-15px', cursor: 'ns-resize' })} onPointerDown={begin('bottom')} />
        </>
      )}
    </div>
  )
}
