import type { CaptionStyle, Segment, TextOverlay, WordTiming } from './types'

export const PROJECT_VERSION = 1

/** Everything needed to reopen an edit exactly where it was left. */
export interface Project {
  v: number
  id: string
  name: string
  /** absolute path to the source video on this machine */
  videoPath: string
  createdAt: number
  updatedAt: number

  language: string
  modelId: string
  segments: Segment[]
  words: WordTiming[] | null
  style: CaptionStyle
  overlays: TextOverlay[]
  delaySec: number
  dragScope: 'all' | 'line'
}

export interface ProjectSummary {
  id: string
  name: string
  videoPath: string
  /** absolute path to a cached thumbnail frame, or null */
  thumbPath: string | null
  updatedAt: number
  /** true if the source video is no longer at videoPath */
  missing: boolean
  lineCount: number
}
