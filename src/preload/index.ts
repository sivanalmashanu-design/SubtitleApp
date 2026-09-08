import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  CaptionStyle,
  JobProgress,
  ModelInfo,
  ModelProgress,
  Segment,
  TextOverlay,
  TranscriptResult,
  VideoDims,
  WordTiming,
} from '@shared/types'
import type { Project, ProjectSummary } from '@shared/project'

function subscribe<T>(channel: string, cb: (data: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  /** Resolve the absolute path of a File the user dropped or picked. */
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  /** Wrap an absolute path as a media:// URL the <video> element can load. */
  mediaUrl: (absPath: string): string =>
    `media://local/${encodeURIComponent(absPath.replace(/\\/g, '/'))}`,

  checkBinaries: (): Promise<{ ok: boolean; missing: string[] }> =>
    ipcRenderer.invoke('binaries:check'),

  listModels: (): Promise<ModelInfo[]> => ipcRenderer.invoke('models:list'),

  listCustomFonts: (): Promise<{ family: string; file: string }[]> =>
    ipcRenderer.invoke('fonts:list'),
  addCustomFont: (): Promise<{ family: string; file: string }[]> => ipcRenderer.invoke('fonts:add'),

  pickVideo: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickVideo'),
  listProjects: (): Promise<ProjectSummary[]> => ipcRenderer.invoke('projects:list'),
  loadProject: (id: string): Promise<Project | null> => ipcRenderer.invoke('projects:load', id),
  saveProject: (p: Project): Promise<{ id: string; updatedAt: number }> =>
    ipcRenderer.invoke('projects:save', p),
  deleteProject: (id: string): Promise<void> => ipcRenderer.invoke('projects:delete', id),
  downloadModel: (id: string): Promise<ModelInfo[]> => ipcRenderer.invoke('models:download', id),
  onModelProgress: (cb: (p: ModelProgress) => void) => subscribe('models:progress', cb),

  transcribe: (payload: {
    videoPath: string
    modelId: string
    language: string | null
    wordTimings: boolean
  }): Promise<TranscriptResult> => ipcRenderer.invoke('transcribe', payload),

  burn: (payload: {
    videoPath: string
    segments: Segment[]
    words: WordTiming[] | null
    style: CaptionStyle
    video: VideoDims
    overlays: TextOverlay[]
    delaySec: number
  }): Promise<{ canceled: true } | { canceled: false; filePath: string }> =>
    ipcRenderer.invoke('burn', payload),

  onJobProgress: (cb: (p: JobProgress) => void) => subscribe('job:progress', cb),

  /** Abort an in-progress export. */
  cancelBurn: (): Promise<void> => ipcRenderer.invoke('burn:cancel'),

  /** Copy the finished export somewhere the user chooses. */
  saveExportCopy: (
    srcPath: string,
  ): Promise<{ canceled: true } | { canceled: false; filePath: string }> =>
    ipcRenderer.invoke('export:saveCopy', srcPath),
  /** Open the finished export in the OS default video player. */
  playExport: (filePath: string): Promise<string> => ipcRenderer.invoke('export:play', filePath),
  /** Open the OS share sheet (macOS: AirDrop/Messages/Mail/…) for the export. */
  shareExport: (filePath: string): Promise<{ ok: boolean; note?: string }> =>
    ipcRenderer.invoke('export:share', filePath),
  /** Start a new email with the export attached. */
  emailExport: (filePath: string): Promise<void> => ipcRenderer.invoke('export:email', filePath),

  saveText: (payload: {
    suggestedName: string
    content: string
  }): Promise<{ canceled: true } | { canceled: false; filePath: string }> =>
    ipcRenderer.invoke('save:text', payload),

  reveal: (filePath: string): Promise<void> => ipcRenderer.invoke('reveal', filePath),

  /** Main asks the renderer to persist the open project right before the window closes. */
  onFlush: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('app:flush', listener)
    return () => ipcRenderer.removeListener('app:flush', listener)
  },
  flushDone: (): void => ipcRenderer.send('app:flush-done'),
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
