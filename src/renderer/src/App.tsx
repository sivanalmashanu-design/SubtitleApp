import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { CaptionControls } from './components/CaptionControls'
import { CaptionOverlay } from './components/CaptionOverlay'
import { DragBox } from './components/DragBox'
import { ExportModal } from './components/ExportModal'
import { HomeScreen } from './components/HomeScreen'
import { SafeAreaGuides, type GuidePlatform } from './components/SafeAreaGuides'
import { OverlaysPanel } from './components/OverlaysPanel'
import { TemplateList } from './components/TemplateList'
import { Timeline } from './components/Timeline'
import { TranscriptEditor } from './components/TranscriptEditor'
import { FontPicker } from './components/FontPicker'
import { toSRT, toVTT } from '@shared/subtitles'
import { isRtl } from '@shared/ass'
import { isHebrewFont } from '@shared/fonts'
import { editRuns, normText, rangeStyle, styledRuns } from '@shared/runs'
import { packRows } from '@shared/tracks'
import { activeCaption } from './lib/activeCaption'
import { injectCustomFonts } from './lib/injectFonts'
import {
  addFavStyle,
  loadFavStyles,
  loadGuides,
  loadLastLanguage,
  loadLastStyle,
  removeFavStyle,
  renameFavStyle,
  saveGuides,
  saveLastLanguage,
  saveLastStyle,
} from './lib/prefs'
import type { Project } from '@shared/project'
import {
  DEFAULT_CAPTION_STYLE,
  newTextOverlay,
  type CaptionBox,
  type CaptionStyle,
  type JobProgress,
  type ModelInfo,
  type Segment,
  type TextOverlay,
  type VideoDims,
  type WordStyle,
  type WordTiming,
} from '@shared/types'

const LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ['he', 'Hebrew'],
  ['auto', 'Detect automatically'],
  ['en', 'English'],
  ['ar', 'Arabic'],
  ['ru', 'Russian'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt', 'Portuguese'],
  ['it', 'Italian'],
  ['uk', 'Ukrainian'],
  ['pl', 'Polish'],
]

type Phase = 'idle' | 'transcribing' | 'ready' | 'burning' | 'error'
type Tab = 'captions' | 'style' | 'cards'
type StyleTab = 'templates' | 'text' | 'breaks'

const pct = (r: number): string => `${Math.round(Math.max(0, Math.min(1, r)) * 100)}%`
function hexRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '').padEnd(6, '0')
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${Math.max(0, Math.min(1, opacity)).toFixed(2)})`
}
const fmtTime = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
const STAGE_LABEL: Record<JobProgress['stage'], string> = {
  extract: 'Extracting audio…',
  transcribe: 'Transcribing…',
  words: 'Timing each word…',
  burn: 'Rendering captions…',
}

export default function App() {
  const [binaries, setBinaries] = useState<{ ok: boolean; missing: string[] } | null>(null)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelId, setModelId] = useState('large-v3')
  const [dl, setDl] = useState<{ id: string; ratio: number; mb: number } | null>(null)

  const [video, setVideo] = useState<{ path: string; name: string } | null>(null)
  const [dims, setDims] = useState<VideoDims | null>(null)
  const [language, setLanguage] = useState('he')
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [segments, setSegments] = useState<Segment[]>([])
  const [words, setWords] = useState<Parameters<typeof activeCaption>[1]>(null)
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE)
  const [overlays, setOverlays] = useState<TextOverlay[]>([])
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [delaySec, setDelaySec] = useState(0)
  const [showCaptions, setShowCaptions] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [guides, setGuides] = useState<GuidePlatform>(() => loadGuides())
  const [favStyles, setFavStyles] = useState(() => loadFavStyles())
  const [renamingFav, setRenamingFav] = useState<string | null>(null)
  const [editSegId, setEditSegId] = useState<string | null>(null)
  /** character range within a caption currently being restyled */
  const [editRange, setEditRange] = useState<{ segId: string; from: number; to: number } | null>(
    null,
  )
  const editRangeRef = useRef(editRange)
  editRangeRef.current = editRange
  const numPref = (key: string, def: number): number => {
    try {
      const v = Number(localStorage.getItem(key))
      return Number.isFinite(v) && v > 0 ? v : def
    } catch {
      return def
    }
  }
  const [sideW, setSideW] = useState<number>(() =>
    numPref('as:sideW', Math.round(window.innerWidth * 0.34)),
  )
  const [timelineH, setTimelineH] = useState<number>(() => numPref('as:timelineH', 210))

  const [tab, setTab] = useState<Tab>('captions')
  const [styleTab, setStyleTab] = useState<StyleTab>('templates')
  const [customFonts, setCustomFonts] = useState<{ family: string; file: string }[]>([])

  const [view, setView] = useState<'home' | 'editor'>('home')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled')
  const projectCreatedAt = useRef(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const stageWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.checkBinaries().then(setBinaries)
    window.api.listModels().then((m) => {
      setModels(m)
      const installed = m.find((x) => x.installed)
      if (installed) setModelId(installed.id)
    })
    window.api.listCustomFonts().then((f) => {
      setCustomFonts(f)
      injectCustomFonts(f)
    })
    const offJob = window.api.onJobProgress((p) => {
      // ignore late events after a job ended (e.g. a cancelled export)
      if (phaseRef.current === 'burning' || phaseRef.current === 'transcribing') setProgress(p)
    })
    const offDl = window.api.onModelProgress(setDl)
    const onFs = (): void => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      offJob()
      offDl()
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])

  // debounced autosave of the open project
  useEffect(() => {
    if (view !== 'editor' || !video) return
    const t = setTimeout(() => {
      void window.api
        .saveProject({
          v: 1,
          id: projectId ?? '',
          name: projectName || 'Untitled',
          videoPath: video.path,
          createdAt: projectCreatedAt.current,
          updatedAt: Date.now(),
          language,
          modelId,
          segments,
          words,
          style,
          overlays,
          delaySec,
          dragScope: 'all',
        })
        .then((res) => {
          if (!projectId) setProjectId(res.id)
          if (!projectCreatedAt.current) projectCreatedAt.current = res.updatedAt
        })
    }, 700)
    return () => clearTimeout(t)
  }, [
    view,
    video,
    projectId,
    projectName,
    language,
    modelId,
    segments,
    words,
    style,
    overlays,
    delaySec,
  ])

  // remember the last style / language as the default for the next new project
  useEffect(() => {
    if (view === 'editor') saveLastStyle(style)
  }, [view, style])
  useEffect(() => {
    if (view === 'editor') saveLastLanguage(language)
  }, [view, language])
  useEffect(() => {
    saveGuides(guides)
  }, [guides])

  const currentModel = models.find((m) => m.id === modelId)
  const modelReady = !!currentModel?.installed
  const portrait = !dims || dims.height >= dims.width

  // a project may have been saved with a model that no longer exists
  useEffect(() => {
    if (models.length && !models.some((m) => m.id === modelId)) {
      setModelId(models.find((m) => m.installed)?.id ?? models[0].id)
    }
  }, [models, modelId])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    let raf = 0
    const loop = (): void => {
      setCurrentTime(el.currentTime)
      raf = requestAnimationFrame(loop)
    }
    const start = (): void => {
      setPlaying(true)
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    const stop = (): void => {
      setPlaying(false)
      cancelAnimationFrame(raf)
    }
    const sync = (): void => setCurrentTime(el.currentTime)
    el.addEventListener('play', start)
    el.addEventListener('pause', stop)
    el.addEventListener('seeked', sync)
    return () => {
      el.removeEventListener('play', start)
      el.removeEventListener('pause', stop)
      el.removeEventListener('seeked', sync)
      stop()
    }
  }, [video])

  const activeSegment = useMemo(
    () => segments.find((s) => currentTime >= s.start && currentTime < s.end) ?? null,
    [segments, currentTime],
  )

  const caption = useMemo(
    () =>
      activeCaption(segments, words, currentTime, style, !!video && segments.length === 0, delaySec, dims),
    [segments, words, currentTime, style, video, delaySec, dims],
  )

  const busy = phase === 'transcribing' || phase === 'burning' || !!dl

  // style shown in the preview: a line's own override wins; otherwise the global style
  const displayStyle = activeSegment?.styleOverride ?? style
  // the caption the Style panel acts on = whatever's under the playhead
  const targetSeg = activeSegment
  // the "This caption / All captions" toggle isn't a mode you set — it just
  // reflects the caption in view: "This caption" when it has its own style or
  // position, or when you've explicitly chosen to style it (editSegId).
  const dragScope: 'all' | 'line' =
    targetSeg && (!!targetSeg.styleOverride || !!targetSeg.box || editSegId === targetSeg.id)
      ? 'line'
      : 'all'
  const editingLine = dragScope === 'line' && !!targetSeg
  const panelStyle =
    editingLine && targetSeg
      ? (targetSeg.styleOverride ?? { ...style, box: targetSeg.box ?? style.box })
      : style

  // drop the "style this line" intent once the playhead leaves that line
  useEffect(() => {
    if (editSegId && activeSegment?.id !== editSegId) setEditSegId(null)
    if (editRangeRef.current && activeSegment?.id !== editRangeRef.current.segId) setEditRange(null)
  }, [activeSegment?.id])

  /** merge `patch` into the current `editRange` (null clears every field there) */
  const setRangeStyle = useCallback((patch: Partial<WordStyle> | null) => {
    const r = editRangeRef.current
    if (!r) return
    setSegments((segs) =>
      segs.map((s) => {
        if (s.id !== r.segId) return s
        const len = Math.max(normText(s.text).length, r.to)
        const next = editRuns(styledRuns(s), len, r.from, r.to, patch === null ? null : patch)
        return { ...s, runs: next.length ? next : undefined, wordStyles: undefined }
      }),
    )
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('as:sideW', String(Math.round(sideW)))
      localStorage.setItem('as:timelineH', String(Math.round(timelineH)))
    } catch {
      /* ignore */
    }
  }, [sideW, timelineH])

  const startResize = (axis: 'x' | 'y') => (e: ReactPointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent): void => {
      if (axis === 'x') {
        setSideW(Math.max(280, Math.min(window.innerWidth * 0.6, window.innerWidth - ev.clientX)))
      } else {
        setTimelineH(Math.max(120, Math.min(window.innerHeight * 0.55, window.innerHeight - ev.clientY)))
      }
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // space toggles play/pause when not typing in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      e.preventDefault()
      const el = videoRef.current
      if (el) el.paused ? void el.play().catch(() => {}) : el.pause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // overlay stacking: row 0 is the top channel and renders on top
  const overlayRowMap = useMemo(
    () => packRows(overlays.map((o) => ({ id: o.id, start: o.start, end: o.end }))),
    [overlays],
  )

  // warn when Hebrew captions are set to a font with no Hebrew glyphs
  const captionsAreHebrew = useMemo(() => segments.some((s) => isRtl(s.text)), [segments])
  const hebrewFontMismatch =
    captionsAreHebrew &&
    panelStyle.fontName !== 'System' &&
    !isHebrewFont(panelStyle.fontName) &&
    !customFonts.some((f) => f.family === panelStyle.fontName)

  const dragScopeRef = useRef(dragScope)
  dragScopeRef.current = dragScope
  const activeSegRef = useRef(activeSegment)
  activeSegRef.current = activeSegment
  const targetSegRef = useRef(targetSeg)
  targetSegRef.current = targetSeg

  const onStyleChange = useCallback((next: CaptionStyle) => {
    if (dragScopeRef.current === 'line' && targetSegRef.current) {
      const id = targetSegRef.current.id
      setSegments((segs) => segs.map((s) => (s.id === id ? { ...s, styleOverride: next } : s)))
    } else {
      setStyle(next)
    }
  }, [])

  const resetLineStyle = useCallback(() => {
    const seg = targetSegRef.current
    if (!seg) return
    setSegments((segs) =>
      segs.map((s) => (s.id === seg.id ? { ...s, styleOverride: null, box: null } : s)),
    )
  }, [])

  const onCaptionBox = useCallback((box: CaptionBox) => {
    if (dragScopeRef.current === 'line' && targetSegRef.current) {
      const id = targetSegRef.current.id
      setSegments((segs) =>
        segs.map((s) =>
          s.id === id
            ? s.styleOverride
              ? { ...s, styleOverride: { ...s.styleOverride, box } }
              : { ...s, box }
            : s,
        ),
      )
    } else {
      setStyle((s) => ({ ...s, box }))
    }
  }, [])
  const delayRef = useRef(delaySec)
  delayRef.current = delaySec
  const onSegmentTimes = useCallback((id: string, start: number, end: number) => {
    const off = delayRef.current
    setSegments((segs) =>
      segs.map((s) =>
        s.id === id
          ? { ...s, start: Math.max(0, start - off), end: Math.max(start - off + 0.1, end - off) }
          : s,
      ),
    )
  }, [])
  const onOverlayTimes = useCallback((id: string, start: number, end: number) => {
    setOverlays((p) => p.map((o) => (o.id === id ? { ...o, start, end } : o)))
  }, [])
  const addOverlayAt = useCallback((atSec: number) => {
    const ov = newTextOverlay(atSec)
    setOverlays((p) => [...p, ov])
    setSelectedOverlayId(ov.id)
    setTab('cards')
  }, [])

  // drag a timeline block onto the other lane: caption <-> card
  const styleRef = useRef(style)
  styleRef.current = style
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const overlaysRef = useRef(overlays)
  overlaysRef.current = overlays
  const moveBlockLane = useCallback((from: 'seg' | 'ov', id: string, to: 'seg' | 'ov') => {
    if (from === to) return
    const off = delayRef.current
    const gs = styleRef.current
    if (from === 'seg' && to === 'ov') {
      const seg = segmentsRef.current.find((s) => s.id === id)
      if (!seg) return
      const st = seg.styleOverride ?? gs
      const base = newTextOverlay(Math.max(0, seg.start + off))
      const ov: TextOverlay = {
        ...base,
        text: seg.text,
        start: Math.max(0, seg.start + off),
        end: Math.max(0.2, seg.end + off),
        box: seg.styleOverride?.box ?? seg.box ?? gs.box,
        fontScale: st.fontScale,
        fontName: st.fontName,
        color: st.primaryColor,
        allCaps: st.allCaps,
        bold: st.bold,
        outline: st.outline,
        animation: 'none',
        background: { ...st.background },
      }
      setSegments((p) => p.filter((s) => s.id !== id))
      setOverlays((p) => [...p, ov])
      setSelectedOverlayId(ov.id)
      setTab('cards')
    } else {
      const ov = overlaysRef.current.find((o) => o.id === id)
      if (!ov) return
      const seg: Segment = {
        id: `seg-${crypto.randomUUID()}`,
        start: Math.max(0, ov.start - off),
        end: Math.max(0.2, ov.end - off),
        text: ov.text,
        box: ov.box,
      }
      setOverlays((p) => p.filter((o) => o.id !== id))
      setSegments((p) => [...p, seg].sort((a, b) => a.start - b.start))
      setSelectedOverlayId(null)
      setTab('captions')
    }
  }, [])

  // timeline block right-click / double-click actions
  const onOpenSegment = useCallback((id: string) => {
    const s = segmentsRef.current.find((x) => x.id === id)
    const el = videoRef.current
    if (s && el) {
      el.pause()
      el.currentTime = s.start + delayRef.current
    }
    setTab('captions')
  }, [])
  const onOpenOverlay = useCallback((id: string) => {
    setSelectedOverlayId(id)
    setTab('cards')
  }, [])
  const onStyleSegment = useCallback((id: string) => {
    const s = segmentsRef.current.find((x) => x.id === id)
    const el = videoRef.current
    if (s && el) {
      el.pause()
      el.currentTime = s.start + delayRef.current
    }
    setEditSegId(id)
    setTab('style')
    setStyleTab('text')
  }, [])
  const onDeleteSegment = useCallback((id: string) => {
    setSegments((p) => p.filter((s) => s.id !== id))
  }, [])
  const onDeleteOverlay = useCallback((id: string) => {
    setOverlays((p) => p.filter((o) => o.id !== id))
    setSelectedOverlayId((cur) => (cur === id ? null : cur))
  }, [])
  const onDuplicateOverlay = useCallback((id: string) => {
    const ov = overlaysRef.current.find((o) => o.id === id)
    if (!ov) return
    const copy: TextOverlay = {
      ...ov,
      id: `ov-${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      box: { ...ov.box },
      background: { ...ov.background },
    }
    setOverlays((p) => [...p, copy])
    setSelectedOverlayId(copy.id)
  }, [])

  const baseName = (p: string): string => (p.split(/[\\/]/).pop() ?? p).replace(/\.[^.]+$/, '')

  const newProject = useCallback(async () => {
    const path = await window.api.pickVideo()
    if (!path) return
    setVideo({ path, name: path.split(/[\\/]/).pop() ?? path })
    setDims(null)
    setDuration(0)
    setDelaySec(0)
    setSegments([])
    setWords(null)
    setOverlays([])
    setSelectedOverlayId(null)
    setResult(null)
    setError(null)
    setPhase('idle')
    setStyle(loadLastStyle())
    setEditSegId(null)
    setEditRange(null)
    setLanguage(loadLastLanguage())
    // assign the id up front so every autosave from here targets one stable folder
    setProjectId(crypto.randomUUID())
    projectCreatedAt.current = Date.now()
    setProjectName(baseName(path))
    setTab('captions')
    setStyleTab('templates')
    setView('editor')
  }, [])

  const openProject = useCallback(async (id: string) => {
    const p = await window.api.loadProject(id)
    if (!p) return
    setProjectId(p.id)
    projectCreatedAt.current = p.createdAt
    setProjectName(p.name)
    setVideo({ path: p.videoPath, name: p.videoPath.split(/[\\/]/).pop() ?? p.videoPath })
    setDims(null)
    setDuration(0)
    setLanguage(p.language)
    setModelId(p.modelId)
    // migrate v1.0.3 per-word tweaks to the character-range model
    setSegments(
      p.segments.map((s) =>
        s.wordStyles && !s.runs
          ? { ...s, runs: styledRuns(s), wordStyles: undefined }
          : s,
      ),
    )
    setWords((p.words as WordTiming[] | null) ?? null)
    setStyle(p.style)
    setOverlays(p.overlays)
    setDelaySec(p.delaySec)
    setEditSegId(null)
    setEditRange(null)
    setSelectedOverlayId(null)
    setResult(null)
    setError(null)
    setPhase('ready')
    setTab(p.segments.length ? 'style' : 'captions')
    setView('editor')
  }, [])

  const addFont = useCallback(async () => {
    const f = await window.api.addCustomFont()
    setCustomFonts(f)
    injectCustomFonts(f)
    if (f.length) setStyle((s) => ({ ...s, fontName: f[f.length - 1].family }))
  }, [])

  const toggleFullscreen = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void stageWrapRef.current?.requestFullscreen()
  }

  async function downloadModel(id: string): Promise<void> {
    setError(null)
    setDl({ id, ratio: 0, mb: 0 })
    try {
      setModels(await window.api.downloadModel(id))
      setModelId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDl(null)
    }
  }

  async function generate(): Promise<void> {
    if (!video || !modelReady) return
    setError(null)
    setResult(null)
    setProgress({ stage: 'extract', ratio: 0 })
    setPhase('transcribing')
    try {
      const res = await window.api.transcribe({
        videoPath: video.path,
        modelId,
        language: language === 'auto' ? null : language,
        wordTimings: true,
      })
      setSegments(res.segments)
      setWords(res.words)
      setPhase('ready')
      setTab('style')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    } finally {
      setProgress(null)
    }
  }

  async function burn(): Promise<void> {
    if (!video || !dims || (segments.length === 0 && overlays.length === 0)) return
    setError(null)
    setResult(null)
    setCanceling(false)
    setProgress({ stage: 'burn', ratio: 0 })
    setPhase('burning')
    try {
      const res = await window.api.burn({
        videoPath: video.path,
        segments,
        words,
        style,
        video: dims,
        overlays,
        delaySec,
      })
      if (!res.canceled) {
        setResult(res.filePath)
        setExportOpen(true)
      }
      setPhase('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    } finally {
      setProgress(null)
      setCanceling(false)
    }
  }

  const seek = (seconds: number): void => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = seconds
    void el.play().catch(() => {})
  }

  const saveText = (ext: 'srt' | 'vtt'): void => {
    void window.api.saveText({
      suggestedName: `${projectName || 'captions'}.${ext}`,
      content: ext === 'srt' ? toSRT(segments) : toVTT(segments),
    })
  }

  const snapshot = (): Project => ({
    v: 1,
    id: projectId ?? '',
    name: projectName || 'Untitled',
    videoPath: video?.path ?? '',
    createdAt: projectCreatedAt.current,
    updatedAt: Date.now(),
    language,
    modelId,
    segments,
    words,
    style,
    overlays,
    delaySec,
    dragScope,
  })

  const saveNow = async (): Promise<void> => {
    if (!video) return
    const res = await window.api.saveProject(snapshot())
    if (!projectId) setProjectId(res.id)
    projectCreatedAt.current = projectCreatedAt.current || res.updatedAt
  }

  // Persist on window close — autosave is debounced, so a quick close would lose it.
  const flushRef = useRef<() => Promise<void>>(async () => {})
  flushRef.current = async () => {
    if (!video || !projectId) return
    try {
      await window.api.saveProject(snapshot())
    } catch {
      /* best effort */
    }
  }
  useEffect(
    () =>
      window.api.onFlush(() => {
        void flushRef.current().finally(() => window.api.flushDone())
      }),
    [],
  )

  const backToHome = async (): Promise<void> => {
    await saveNow()
    setView('home')
    setVideo(null)
    setProjectId(null)
  }

  // ---- home screen ----------------------------------------------------
  if (view === 'home' || !video) {
    return <HomeScreen onOpen={openProject} onNew={newProject} />
  }

  const stageStyle = {
    aspectRatio: dims ? `${dims.width} / ${dims.height}` : '9 / 16',
    height: portrait ? '100%' : undefined,
    width: portrait ? undefined : '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  } as const

  const canExport = segments.length > 0 || overlays.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0b0f17]">
      {/* top bar */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-2">
        <button
          type="button"
          onClick={() => void backToHome()}
          className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-slate-800"
          title="Save & back to projects"
        >
          ‹ Projects
        </button>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="min-w-0 flex-1 rounded bg-transparent text-sm text-slate-200 outline-none hover:bg-slate-800/50 focus:bg-slate-800"
          spellCheck={false}
        />
        <span className="shrink-0 text-xs text-slate-600">
          {dims ? `${dims.width}×${dims.height}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-400" title="Overlay a platform's UI as a positioning guide (not exported)">
            <span>Guide</span>
            <select
              value={guides}
              onChange={(e) => setGuides(e.target.value as GuidePlatform)}
              className="rounded bg-slate-800 px-1.5 py-1 text-xs text-slate-200"
            >
              <option value="none">Off</option>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={showCaptions}
              onChange={(e) => setShowCaptions(e.target.checked)}
            />
            Preview
          </label>
          <button
            type="button"
            onClick={burn}
            disabled={busy || !canExport}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-40"
          >
            Export
          </button>
        </div>
      </div>

      {binaries && !binaries.ok && (
        <p className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-1.5 text-xs text-rose-200">
          Missing bundled tools: {binaries.missing.join(', ')} — run <code>npm run fetch-binaries</code>.
        </p>
      )}
      {progress && (
        <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-300">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
          <span>{STAGE_LABEL[progress.stage]}</span>
          <div className="ml-2 h-1 flex-1 overflow-hidden rounded bg-slate-800">
            <div className="h-full bg-sky-400 transition-[width]" style={{ width: pct(progress.ratio) }} />
          </div>
          <span className="tabular-nums text-slate-400">{pct(progress.ratio)}</span>
          {progress.stage === 'burn' && phase === 'burning' && (
            <button
              type="button"
              disabled={canceling}
              onClick={() => {
                setCanceling(true)
                void window.api.cancelBurn()
              }}
              className="ml-2 shrink-0 rounded border border-slate-600 px-2 py-0.5 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              {canceling ? 'Canceling…' : 'Cancel'}
            </button>
          )}
        </div>
      )}
      {error && (
        <pre className="max-h-28 overflow-auto border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs whitespace-pre-wrap text-rose-200">
          {error}
        </pre>
      )}
      {result && !exportOpen && (
        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs text-emerald-100">
          <span className="truncate">✓ Exported — {result.split(/[\\/]/).pop()}</span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded bg-emerald-500 px-2 py-0.5 font-medium text-white hover:bg-emerald-400"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded px-1.5 text-emerald-300/80 hover:bg-emerald-500/20"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {result && exportOpen && (
        <ExportModal path={result} onClose={() => setExportOpen(false)} />
      )}

      {/* main row: preview + transport on the left, the panel on the right */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">

      {/* preview */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={stageWrapRef}
          className="stage-wrap absolute inset-0 flex items-center justify-center p-3"
        >
          <div
            className="caption-stage relative overflow-hidden rounded-xl border border-slate-800 bg-black"
            style={stageStyle}
            onPointerDown={() => setSelectedOverlayId(null)}
            onDoubleClick={toggleFullscreen}
          >
            <SafeAreaGuides platform={guides} />
            <video
              ref={videoRef}
              src={window.api.mediaUrl(video.path)}
              disablePictureInPicture
              onClick={(e) => {
                // click the frame to play/pause (no native control bar in-frame)
                e.stopPropagation()
                const el = e.currentTarget
                el.paused ? void el.play().catch(() => {}) : el.pause()
              }}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleFullscreen()
              }}
              onLoadedMetadata={(e) => {
                setDims({
                  width: e.currentTarget.videoWidth || 1920,
                  height: e.currentTarget.videoHeight || 1080,
                })
                if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration)
              }}
              onDurationChange={(e) => {
                if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration)
              }}
              className="h-full w-full bg-black"
            />

            {showCaptions && (
              <CaptionOverlay
                caption={caption}
                style={displayStyle}
                editable={!busy && !selectedOverlayId && !playing}
                selectedRange={
                  editRange && activeSegment?.id === editRange.segId
                    ? { from: editRange.from, to: editRange.to }
                    : null
                }
                onWordClick={(from, to) => {
                  if (!activeSegment) return
                  setEditRange({ segId: activeSegment.id, from, to })
                  setTab('style')
                  setStyleTab('text')
                }}
                onBoxChange={onCaptionBox}
                onSeekToActive={() => {
                  if (!activeSegment) return
                  const el = videoRef.current
                  if (el) {
                    el.pause()
                    el.currentTime = activeSegment.start + delaySec
                  }
                  setEditSegId(null)
                  setEditRange(null)
                }}
              />
            )}

            {showCaptions &&
              overlays.map((ov) => {
                const live = currentTime >= ov.start && currentTime < ov.end
                const sel = selectedOverlayId === ov.id
                // outside its time range: only show it (faded, for editing) while
                // it's the selected card on the Cards tab — otherwise it's gone
                const editing = sel && tab === 'cards' && !busy
                if (!live && !editing) return null
                const anim =
                  ov.animation === 'pop' || ov.animation === 'zoom'
                    ? 'cap-pop .24s cubic-bezier(.2,1.4,.4,1)'
                    : ov.animation === 'slide-up'
                      ? 'cap-slide-up .24s ease-out'
                      : ov.animation === 'slide-down'
                        ? 'cap-slide-down .24s ease-out'
                        : ov.animation === 'slide-left'
                          ? 'cap-slide-left .24s ease-out'
                          : ov.animation === 'slide-right'
                            ? 'cap-slide-right .24s ease-out'
                            : ov.animation === 'fade' || ov.animation === 'wipe'
                              ? 'cap-fade .2s ease-out'
                              : undefined
                const row = overlayRowMap.get(ov.id) ?? 0
                return (
                  <DragBox
                    key={ov.id}
                    box={ov.box}
                    editable={!busy && sel && !playing}
                    selected={sel}
                    z={40 - row}
                    onBox={(box) => setOverlays((p) => p.map((o) => (o.id === ov.id ? { ...o, box } : o)))}
                    onSelect={() => setSelectedOverlayId(ov.id)}
                    onClick={() => seek(ov.start)}
                  >
                    <span
                      style={{
                        fontFamily:
                          ov.fontName === 'System' ? 'system-ui, sans-serif' : `'${ov.fontName}', sans-serif`,
                        fontWeight: ov.bold ? 800 : 500,
                        fontSize: `${ov.fontScale}cqh`,
                        lineHeight: 1.2,
                        color: ov.color,
                        opacity: live ? 1 : 0.4,
                        textTransform: ov.allCaps ? 'uppercase' : 'none',
                        direction: isRtl(ov.text) ? 'rtl' : 'ltr',
                        textAlign: 'center',
                        whiteSpace: 'pre-line',
                        animation: live ? anim : undefined,
                        ...(ov.background.enabled
                          ? {
                              display: 'inline-block',
                              background: hexRgba(ov.background.color, ov.background.opacity),
                              padding: '0.16em 0.36em',
                              borderRadius: '0.16em',
                              WebkitTextStroke: `${((ov.outline / 1080) * 100 * 0.25).toFixed(2)}cqh #000`,
                              paintOrder: 'stroke fill',
                            }
                          : {
                              WebkitTextStroke: `${((ov.outline / 1080) * 100 * 1.6).toFixed(2)}cqh #000`,
                              paintOrder: 'stroke fill',
                            }),
                      }}
                    >
                      {ov.text || 'TEXT'}
                    </span>
                  </DragBox>
                )
              })}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
            >
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>
        </div>
      </div>

      {/* transport — play/pause + scrub, outside the video frame */}
      <div className="flex items-center gap-3 border-t border-slate-800 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300">
        <button
          type="button"
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            el.paused ? void el.play().catch(() => {}) : el.pause()
          }}
          className="rounded px-2 py-1 text-sm hover:bg-slate-800"
          title={playing ? 'Pause (space)' : 'Play (space)'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <span className="tabular-nums text-slate-400">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.02}
          value={Math.min(currentTime, duration || 0)}
          onChange={(e) => {
            const el = videoRef.current
            if (el) el.currentTime = Number(e.target.value)
          }}
          className="h-1 flex-1 accent-sky-400"
        />
        <button
          type="button"
          onClick={() => {
            const el = videoRef.current
            if (!el) return
            el.muted = !el.muted
            setMuted(el.muted)
          }}
          className="rounded px-2 py-1 hover:bg-slate-800"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
        </div>
        {/* vertical divider */}
        <div
          onPointerDown={startResize('x')}
          title="Drag to resize"
          className="w-1.5 shrink-0 cursor-col-resize bg-slate-950/70 hover:bg-sky-600"
        />
        {/* right panel */}
        <div
          className="flex min-h-0 shrink-0 flex-col border-l border-slate-800 bg-slate-950/60"
          style={{ width: `clamp(280px, ${Math.round(sideW)}px, 60vw)` }}
        >
        <div className="flex shrink-0 border-b border-slate-800">
          {(
            [
              ['captions', 'Captions'],
              ['style', 'Style'],
              ['cards', `Cards${overlays.length ? ` (${overlays.length})` : ''}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 py-2.5 text-sm font-medium ${
                tab === id
                  ? 'border-b-2 border-sky-400 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === 'captions' && (
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Model</span>
                  <select
                    value={modelId}
                    disabled={busy}
                    onChange={(e) => setModelId(e.target.value)}
                    className="rounded-lg bg-slate-800 px-2 py-1.5"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} {m.installed ? '✓' : `· ${m.approxMB} MB`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-400">Spoken language</span>
                  <select
                    value={language}
                    disabled={busy}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="rounded-lg bg-slate-800 px-2 py-1.5"
                  >
                    {LANGUAGES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!modelReady ? (
                <button
                  type="button"
                  onClick={() => downloadModel(modelId)}
                  disabled={!!dl}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  {dl?.id === modelId
                    ? `Downloading… ${pct(dl.ratio)} (${dl.mb.toFixed(0)} MB)`
                    : `Download this model (${currentModel?.approxMB} MB, once)`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  {segments.length ? 'Re-transcribe' : 'Generate captions'}
                </button>
              )}

              {segments.length > 0 && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-300">{segments.length} lines</span>
                    <div className="ml-auto flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveText('srt')}
                        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        .srt
                      </button>
                      <button
                        type="button"
                        onClick={() => saveText('vtt')}
                        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        .vtt
                      </button>
                    </div>
                  </div>
                  <TranscriptEditor
                    segments={segments}
                    activeId={activeSegment?.id ?? null}
                    onChange={setSegments}
                    onSeek={seek}
                    onRestyle={onStyleSegment}
                    onStyleRange={(id, from, to) => {
                      const s = segmentsRef.current.find((x) => x.id === id)
                      const el = videoRef.current
                      if (s && el) {
                        el.pause()
                        el.currentTime = s.start + delayRef.current
                      }
                      setEditRange({ segId: id, from, to })
                      setTab('style')
                      setStyleTab('text')
                    }}
                  />
                </>
              )}
            </div>
          )}

          {tab === 'style' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                {(
                  [
                    ['templates', 'Templates'],
                    ['text', 'Text'],
                    ['breaks', 'Breaks'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStyleTab(id)}
                    className={`rounded-full px-3 py-1 ${
                      styleTab === id ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="ml-auto flex overflow-hidden rounded border border-slate-700 text-xs">
                  {(
                    [
                      ['all', 'All captions'],
                      ['line', 'This caption'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      disabled={busy || !activeSegment}
                      onClick={() => {
                        const id0 = activeSegment?.id
                        if (!id0) return
                        if (id === 'line') {
                          setEditSegId(id0)
                        } else {
                          // back to the global design for this caption
                          setEditSegId(null)
                          setSegments((segs) =>
                            segs.map((s) =>
                              s.id === id0 ? { ...s, styleOverride: null, box: null } : s,
                            ),
                          )
                        }
                      }}
                      className={`px-2 py-1 disabled:opacity-40 ${
                        dragScope === id ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {!activeSegment && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs text-slate-400">
                  Move the playhead onto a caption to use <b>This caption</b>.
                </div>
              )}

              {editingLine && targetSeg && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                  <span className="min-w-0 truncate">
                    Editing just: <b>“{targetSeg.text.replace(/\s+/g, ' ').trim().slice(0, 40)}”</b>
                    {targetSeg.styleOverride ? ' · custom' : ''}
                  </span>
                  {(targetSeg.styleOverride || targetSeg.box) && (
                    <button
                      type="button"
                      onClick={resetLineStyle}
                      className="shrink-0 rounded bg-sky-500/80 px-2 py-0.5 text-white hover:bg-sky-400"
                    >
                      Reset to global
                    </button>
                  )}
                </div>
              )}

              {editRange &&
                activeSegment?.id === editRange.segId &&
                (() => {
                  const o = rangeStyle(styledRuns(activeSegment), editRange.from, editRange.to)
                  const label =
                    normText(activeSegment.text).slice(editRange.from, editRange.to) || '—'
                  return (
                    <div className="flex flex-col gap-2 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100">
                      <div className="flex items-center justify-between">
                        <span className="min-w-0 font-medium">
                          Styling: <b>“{label.length > 32 ? `${label.slice(0, 32)}…` : label}”</b>
                        </span>
                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRangeStyle(null)}
                            className="rounded bg-slate-700 px-2 py-0.5 hover:bg-slate-600"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditRange(null)}
                            className="rounded px-1.5 text-fuchsia-300 hover:bg-fuchsia-500/20"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-fuchsia-200/70">
                        Select text in a caption (Captions tab) or click a word on the preview to pick
                        what to style.
                      </p>
                      <label className="flex flex-col gap-1">
                        <span>Font</span>
                        <FontPicker
                          value={o.fontName || ''}
                          onChange={(v) => setRangeStyle({ fontName: v || undefined })}
                          customFonts={customFonts}
                          onAddFont={addFont}
                          disabled={busy}
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
                            value={o.color || panelStyle.primaryColor}
                            onChange={(e) => setRangeStyle({ color: e.target.value })}
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
                            value={o.sizePct ?? 100}
                            onChange={(e) =>
                              setRangeStyle({
                                sizePct:
                                  Number(e.target.value) === 100 ? undefined : Number(e.target.value),
                              })
                            }
                            className="w-24"
                          />
                          <span className="w-9 tabular-nums">{o.sizePct ?? 100}%</span>
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={o.bold ?? panelStyle.bold}
                            onChange={(e) =>
                              setRangeStyle({
                                bold:
                                  e.target.checked === panelStyle.bold ? undefined : e.target.checked,
                              })
                            }
                          />
                          Bold
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={o.allCaps ?? panelStyle.allCaps}
                            onChange={(e) =>
                              setRangeStyle({
                                allCaps:
                                  e.target.checked === panelStyle.allCaps
                                    ? undefined
                                    : e.target.checked,
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
                            value={o.outline ?? panelStyle.outline}
                            onChange={(e) =>
                              setRangeStyle({
                                outline:
                                  Number(e.target.value) === panelStyle.outline
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
                            value={o.outlineColor || panelStyle.outlineColor || '#000000'}
                            onChange={(e) => setRangeStyle({ outlineColor: e.target.value })}
                            className="h-7 w-9 rounded border border-slate-700 bg-transparent"
                          />
                        </label>
                      </div>
                    </div>
                  )
                })()}

              {hebrewFontMismatch && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  ⚠ Your captions have Hebrew but <b>{panelStyle.fontName}</b> has no Hebrew letters —
                  the export will fall back to another font. Pick a font from the <b>Hebrew ✓</b> group.
                </div>
              )}

              {styleTab === 'templates' && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-300">★ My styles</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = addFavStyle(`Style ${favStyles.length + 1}`, panelStyle)
                          setFavStyles(next)
                          setRenamingFav(next[next.length - 1].id)
                        }}
                        className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200 hover:bg-amber-500/30"
                      >
                        ＋ Save current
                      </button>
                    </div>
                    {favStyles.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Save the current font/size/colors/background as a reusable style.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {favStyles.map((f) => (
                          <span
                            key={f.id}
                            className="flex items-center gap-1 rounded-full bg-slate-800 py-0.5 pr-1 pl-1 text-xs text-slate-200"
                          >
                            {renamingFav === f.id ? (
                              <input
                                autoFocus
                                defaultValue={f.name}
                                onBlur={(e) => {
                                  setFavStyles(renameFavStyle(f.id, e.target.value.trim() || f.name))
                                  setRenamingFav(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur()
                                  if (e.key === 'Escape') setRenamingFav(null)
                                }}
                                className="w-24 rounded bg-slate-700 px-1.5 py-0.5 text-slate-100 outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  onStyleChange({
                                    ...f.style,
                                    box: panelStyle.box,
                                    templateId: undefined,
                                  })
                                }
                                onDoubleClick={() => setRenamingFav(f.id)}
                                title="Click to apply · double-click to rename"
                                className="px-1.5 hover:text-white"
                              >
                                {f.name}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setFavStyles(removeFavStyle(f.id))}
                              className="rounded-full px-1 text-slate-500 hover:bg-slate-700 hover:text-rose-400"
                              title="Delete"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <TemplateList style={panelStyle} onChange={onStyleChange} />
                </div>
              )}
              {styleTab === 'text' && (
                <CaptionControls
                  section="text"
                  style={panelStyle}
                  onChange={onStyleChange}
                  disabled={busy}
                  delaySec={delaySec}
                  onDelay={setDelaySec}
                  customFonts={customFonts}
                  onAddFont={addFont}
                />
              )}
              {styleTab === 'breaks' && (
                <CaptionControls
                  section="breaks"
                  style={panelStyle}
                  onChange={onStyleChange}
                  disabled={busy}
                  delaySec={delaySec}
                  onDelay={setDelaySec}
                />
              )}
            </div>
          )}

          {tab === 'cards' && (
            <OverlaysPanel
              overlays={overlays}
              onChange={setOverlays}
              selectedId={selectedOverlayId}
              onSelect={setSelectedOverlayId}
              currentTime={currentTime}
              disabled={busy}
            />
          )}
        </div>
        </div>
      </div>

      {/* timeline — full width, below the preview + panel */}
      {duration > 0 && (segments.length > 0 || overlays.length > 0) && (
        <>
          <div
            onPointerDown={startResize('y')}
            title="Drag to resize"
            className="h-1.5 shrink-0 cursor-row-resize border-t border-slate-800 bg-slate-950/70 hover:bg-sky-600"
          />
          <div
            className="shrink-0 overflow-y-auto bg-slate-950/40 px-3 py-2"
            style={{ height: `clamp(120px, ${Math.round(timelineH)}px, 55vh)` }}
          >
            <Timeline
              durationS={duration}
              currentTime={currentTime}
              segments={segments}
              overlays={overlays}
              delaySec={delaySec}
              selectedOverlayId={selectedOverlayId}
              onSeek={(t) => {
                const el = videoRef.current
                if (el) el.currentTime = t
              }}
              onSegmentTimes={onSegmentTimes}
              onOverlayTimes={onOverlayTimes}
              onSelectOverlay={setSelectedOverlayId}
              onAddOverlay={addOverlayAt}
              onMoveLane={moveBlockLane}
              onDeleteSegment={onDeleteSegment}
              onDeleteOverlay={onDeleteOverlay}
              onDuplicateOverlay={onDuplicateOverlay}
              onOpenOverlay={onOpenOverlay}
              onOpenSegment={onOpenSegment}
              onStyleSegment={onStyleSegment}
            />
          </div>
        </>
      )}
    </div>
  )
}
