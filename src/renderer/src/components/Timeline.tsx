import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { Segment, TextOverlay } from '@shared/types'
import { packRows } from '@shared/tracks'

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))

interface Props {
  durationS: number
  currentTime: number
  segments: Segment[]
  overlays: TextOverlay[]
  delaySec: number
  selectedOverlayId: string | null
  onSeek: (t: number) => void
  onSegmentTimes: (id: string, start: number, end: number) => void
  onOverlayTimes: (id: string, start: number, end: number) => void
  onSelectOverlay: (id: string | null) => void
  onAddOverlay?: (atSec: number) => void
  /** drop a block onto the other lane — converts caption <-> card */
  onMoveLane?: (from: Lane, id: string, to: Lane) => void
  onDeleteSegment?: (id: string) => void
  onDeleteOverlay?: (id: string) => void
  onDuplicateOverlay?: (id: string) => void
  /** double-click / "edit" a block — open its editor */
  onOpenOverlay?: (id: string) => void
  onOpenSegment?: (id: string) => void
  /** restyle just this caption (enter "This caption" mode on it) */
  onStyleSegment?: (id: string) => void
}

type Menu = { x: number; y: number; lane: Lane; id: string }

type Lane = 'seg' | 'ov'
type Edge = 'move' | 'l' | 'r'
type Drag = {
  lane: Lane
  edge: Edge
  id: string
  start: number
  end: number
  sx: number
  /** other blocks' edge times (display time) this drag can snap to */
  snap: number[]
}

/** snap `t` to the nearest value in `targets` within `tol` seconds; else return `t` */
const magnet = (t: number, targets: number[], tol: number): number => {
  let best = t
  let bestD = tol
  for (const g of targets) {
    const d = Math.abs(g - t)
    if (d < bestD) {
      bestD = d
      best = g
    }
  }
  return best
}

export function Timeline({
  durationS,
  currentTime,
  segments,
  overlays,
  delaySec,
  selectedOverlayId,
  onSeek,
  onSegmentTimes,
  onOverlayTimes,
  onSelectOverlay,
  onAddOverlay,
  onMoveLane,
  onDeleteSegment,
  onDeleteOverlay,
  onDuplicateOverlay,
  onOpenOverlay,
  onOpenSegment,
  onStyleSegment,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const dur = Math.max(1, durationS)
  const pct = (t: number): number => clamp((t / dur) * 100, 0, 100)

  const [menu, setMenu] = useState<Menu | null>(null)
  const [hoverLane, setHoverLane] = useState<Lane | null>(null)
  const hoverLaneRef = useRef<Lane | null>(null)
  const onMoveLaneRef = useRef(onMoveLane)
  onMoveLaneRef.current = onMoveLane

  const onMove = useCallback(
    (e: globalThis.PointerEvent) => {
      const d = drag.current
      const rect = trackRef.current?.getBoundingClientRect()
      if (!d || !rect) return
      const delta = ((e.clientX - d.sx) / rect.width) * dur
      const tol = (7 / rect.width) * dur // ~7px pull
      const write = d.lane === 'seg' ? onSegmentTimes : onOverlayTimes
      if (d.edge === 'move') {
        const len = d.end - d.start
        let s = clamp(d.start + delta, 0, dur - len)
        // snap whichever end lands closest to a neighbour
        const snapS = magnet(s, d.snap, tol)
        const snapE = magnet(s + len, d.snap, tol)
        if (Math.abs(snapS - s) <= Math.abs(snapE - (s + len))) {
          if (snapS !== s) s = clamp(snapS, 0, dur - len)
        } else if (snapE !== s + len) {
          s = clamp(snapE - len, 0, dur - len)
        }
        write(d.id, s, s + len)
      } else if (d.edge === 'l') {
        const s = magnet(clamp(d.start + delta, 0, d.end - 0.15), d.snap, tol)
        write(d.id, clamp(s, 0, d.end - 0.15), d.end)
      } else {
        const en = magnet(clamp(d.end + delta, d.start + 0.15, dur), d.snap, tol)
        write(d.id, d.start, clamp(en, d.start + 0.15, dur))
      }

      // moving the whole block: is the cursor over the *other* lane?
      if (d.edge === 'move' && onMoveLaneRef.current) {
        const under = document.elementFromPoint(e.clientX, e.clientY)
        const laneAttr = under?.closest('[data-lane]')?.getAttribute('data-lane')
        const target = laneAttr === 'seg' || laneAttr === 'ov' ? (laneAttr as Lane) : null
        const next = target && target !== d.lane ? target : null
        if (hoverLaneRef.current !== next) {
          hoverLaneRef.current = next
          setHoverLane(next)
        }
      }
    },
    [dur, onSegmentTimes, onOverlayTimes],
  )

  const onUp = useCallback(() => {
    const d = drag.current
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    const target = hoverLaneRef.current
    hoverLaneRef.current = null
    setHoverLane(null)
    if (d && d.edge === 'move' && target && target !== d.lane) {
      onMoveLaneRef.current?.(d.lane, d.id, target)
    }
  }, [onMove])

  const beginBlock =
    (lane: Lane, edge: Edge, id: string, start: number, end: number) => (e: PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (lane === 'ov') onSelectOverlay(id)
      // every other block's edges (in display time) are snap targets, plus 0 and the end
      const snap: number[] = [0, dur]
      for (const s of segments) {
        if (lane === 'seg' && s.id === id) continue
        snap.push(s.start + delaySec, s.end + delaySec)
      }
      for (const o of overlays) {
        if (lane === 'ov' && o.id === id) continue
        snap.push(o.start, o.end)
      }
      drag.current = { lane, edge, id, start, end, sx: e.clientX, snap }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, { once: true })
    }

  const beginSeek = (e: PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const rect = trackRef.current!.getBoundingClientRect()
    const set = (clientX: number): void =>
      onSeek(clamp(((clientX - rect.left) / rect.width) * dur, 0, dur))
    set(e.clientX)
    const mv = (ev: globalThis.PointerEvent): void => set(ev.clientX)
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', mv), {
      once: true,
    })
  }

  const ticks = Math.min(10, Math.max(2, Math.round(dur / 5)))
  const ovMap = packRows(overlays.map((o) => ({ id: o.id, start: o.start, end: o.end })))
  const ovRows = { map: ovMap, rows: Math.max(1, ...Array.from(ovMap.values()).map((r) => r + 1)) }

  const block = (
    lane: Lane,
    id: string,
    start: number,
    end: number,
    label: string,
    selected: boolean,
    row = 0,
    custom = false,
  ): ReactNode => {
    const l = pct(start)
    const w = Math.max(1, pct(end) - l)
    const color =
      lane === 'seg'
        ? custom
          ? 'bg-fuchsia-600/80 hover:bg-fuchsia-500 ring-1 ring-fuchsia-300'
          : 'bg-sky-600/80 hover:bg-sky-500'
        : selected
          ? 'bg-fuchsia-500'
          : 'bg-fuchsia-600/80 hover:bg-fuchsia-500'
    return (
      <div
        key={id}
        onPointerDown={beginBlock(lane, 'move', id, start, end)}
        onDoubleClick={() => (lane === 'ov' ? onOpenOverlay?.(id) : onOpenSegment?.(id))}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenu({ x: e.clientX, y: e.clientY, lane, id })
        }}
        title={label}
        className={`absolute h-4 cursor-move overflow-hidden rounded px-1.5 text-[9px] leading-4 whitespace-nowrap text-white ${color}`}
        style={{ left: `${l}%`, width: `${w}%`, top: `${4 + row * 20}px` }}
      >
        <span
          onPointerDown={beginBlock(lane, 'l', id, start, end)}
          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/40"
        />
        {label}
        <span
          onPointerDown={beginBlock(lane, 'r', id, start, end)}
          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/40"
        />
      </div>
    )
  }

  return (
    <div className="select-none rounded-xl border border-slate-800 bg-slate-900/40 p-2">
      <div ref={trackRef} className="relative">
        <div
          className="relative h-5 cursor-pointer rounded bg-slate-800/70 text-[10px] text-slate-400"
          onPointerDown={beginSeek}
        >
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const s = (i / ticks) * dur
            return (
              <span key={i} className="absolute top-0.5" style={{ left: `${pct(s)}%`, transform: 'translateX(-50%)' }}>
                {fmt(s)}
              </span>
            )
          })}
        </div>

        <Lane label="Captions" dataLane="seg" highlight={hoverLane === 'seg'}>
          {segments.map((seg) =>
            block(
              'seg',
              seg.id,
              seg.start + delaySec,
              seg.end + delaySec,
              seg.text,
              false,
              0,
              !!seg.styleOverride,
            ),
          )}
        </Lane>

        <Lane
          label="Cards"
          dataLane="ov"
          highlight={hoverLane === 'ov'}
          rows={ovRows.rows}
          action={
            onAddOverlay ? (
              <button
                type="button"
                onClick={() => onAddOverlay(currentTime)}
                title="Add an overlay caption at the playhead"
                className="rounded bg-fuchsia-600/80 px-1.5 text-[10px] leading-4 text-white hover:bg-fuchsia-500"
              >
                ＋
              </button>
            ) : undefined
          }
        >
          {overlays.map((ov) =>
            block(
              'ov',
              ov.id,
              ov.start,
              ov.end,
              ov.text || 'card',
              selectedOverlayId === ov.id,
              ovRows.map.get(ov.id) ?? 0,
            ),
          )}
        </Lane>

        <div
          className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-rose-400"
          style={{ left: `${pct(currentTime)}%` }}
        />
        {/* draggable playhead handle (only the top strip, so it doesn't block blocks) */}
        <div
          className="absolute top-0 z-30 h-5 w-3 -translate-x-1/2 cursor-ew-resize"
          style={{ left: `${pct(currentTime)}%` }}
          onPointerDown={beginSeek}
          title="Drag to scrub"
        >
          <div className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-rose-400" />
        </div>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setMenu(null)} />
          <div
            className="fixed z-50 min-w-32 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 text-xs text-slate-200 shadow-xl"
            style={{ left: menu.x, top: menu.y }}
          >
            {(() => {
              const close = (): void => setMenu(null)
              const item = (label: string, fn?: (id: string) => void, danger?: boolean): ReactNode =>
                fn ? (
                  <button
                    type="button"
                    onClick={() => {
                      fn(menu.id)
                      close()
                    }}
                    className={`block w-full px-3 py-1.5 text-left hover:bg-slate-800 ${
                      danger ? 'text-rose-400' : ''
                    }`}
                  >
                    {label}
                  </button>
                ) : null
              return menu.lane === 'ov' ? (
                <>
                  {item('Edit card', onOpenOverlay)}
                  {item('Duplicate', onDuplicateOverlay)}
                  {item('Delete', onDeleteOverlay, true)}
                </>
              ) : (
                <>
                  {item('Edit text', onOpenSegment)}
                  {item('Restyle this caption', onStyleSegment)}
                  {item('Delete line', onDeleteSegment, true)}
                </>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}

function Lane({
  label,
  rows = 1,
  action,
  dataLane,
  highlight,
  children,
}: {
  label: string
  rows?: number
  action?: ReactNode
  dataLane?: string
  highlight?: boolean
  children: ReactNode
}) {
  return (
    <div
      data-lane={dataLane}
      className={`relative mt-1 rounded bg-slate-800/40 ${
        highlight ? 'ring-2 ring-emerald-400 ring-inset' : ''
      }`}
      style={{ height: `${Math.max(1, rows) * 20 + 4}px` }}
    >
      <span className="absolute top-1 left-1 z-10 text-[9px] text-slate-500">{label}</span>
      {action && <span className="absolute top-0.5 right-0.5 z-10">{action}</span>}
      {children}
    </div>
  )
}

const fmt = (s: number): string => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
