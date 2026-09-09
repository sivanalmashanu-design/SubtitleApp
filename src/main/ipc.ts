import { basename, dirname, extname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { access, copyFile, rm, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { CaptionStyle, Segment, TextOverlay, VideoDims, WordTiming } from '@shared/types'
import { buildAss } from '@shared/ass'
import { exe } from './paths'
import type { Project } from '@shared/project'
import { downloadModel, listModels } from './models'
import { addCustomFonts, listCustomFonts } from './fonts'
import { deleteProject, listProjects, loadProject, saveProject } from './projects'
import { transcribe } from './whisper'
import { burnCaptions } from './ffmpeg'
import { emailFile, shareFile } from './share'

const sender = (e: Electron.IpcMainInvokeEvent): Electron.WebContents => e.sender

/** set while a burn is running so burn:cancel can kill the ffmpeg child */
let burnAbort: AbortController | null = null

const ownerWindow = (e: Electron.IpcMainInvokeEvent): BrowserWindow | undefined =>
  BrowserWindow.fromWebContents(e.sender) ?? undefined

function saveDialog(
  e: Electron.IpcMainInvokeEvent,
  options: Electron.SaveDialogOptions,
): Promise<Electron.SaveDialogReturnValue> {
  const win = ownerWindow(e)
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
}

async function binariesOk(): Promise<{ ok: boolean; missing: string[] }> {
  const missing: string[] = []
  for (const name of ['ffmpeg', 'whisper-cli']) {
    try {
      await access(exe(name))
    } catch {
      missing.push(name)
    }
  }
  return { ok: missing.length === 0, missing }
}

export function registerIpc(): void {
  ipcMain.handle('binaries:check', () => binariesOk())

  ipcMain.handle('models:list', () => listModels())

  ipcMain.handle('fonts:list', () => listCustomFonts())
  ipcMain.handle('fonts:add', (e) => addCustomFonts(BrowserWindow.fromWebContents(e.sender) ?? undefined))

  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:load', (_e, id: string) => loadProject(id))
  ipcMain.handle('projects:save', (_e, p: Project) => saveProject(p))
  ipcMain.handle('projects:delete', (_e, id: string) => deleteProject(id))

  ipcMain.handle('dialog:pickVideo', async (e) => {
    const win = ownerWindow(e)
    const opts: Electron.OpenDialogOptions = {
      title: 'Choose a video',
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] }],
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })

  ipcMain.handle('models:download', async (e, id: string) => {
    await downloadModel(id, (ratio, mb) =>
      sender(e).send('models:progress', { id, ratio, mb }),
    )
    return listModels()
  })

  ipcMain.handle(
    'transcribe',
    async (
      e,
      payload: {
        videoPath: string
        modelId: string
        language: string | null
        wordTimings: boolean
      },
    ) => {
      return transcribe(
        payload.videoPath,
        {
          modelId: payload.modelId,
          language: payload.language,
          wordTimings: payload.wordTimings,
        },
        (stage, ratio) => sender(e).send('job:progress', { stage, ratio }),
      )
    },
  )

  ipcMain.handle(
    'burn',
    async (
      e,
      payload: {
        videoPath: string
        segments: Segment[]
        words: WordTiming[] | null
        style: CaptionStyle
        video: VideoDims
        overlays: TextOverlay[]
        delaySec: number
      },
    ) => {
      // Export straight to a sensible spot next to the source (falling back to
      // Downloads if that folder isn't writable). The renderer offers save / share
      // options once it's done.
      const base = basename(payload.videoPath, extname(payload.videoPath))
      const pick = (dir: string): string => {
        let p = join(dir, `${base}-captioned.mp4`)
        for (let n = 2; existsSync(p); n++) p = join(dir, `${base}-captioned (${n}).mp4`)
        return p
      }
      let filePath = pick(dirname(payload.videoPath))

      const ass = buildAss(
        payload.segments,
        payload.words,
        payload.style,
        payload.video,
        payload.overlays ?? [],
        payload.delaySec ?? 0,
      )
      burnAbort = new AbortController()
      const sig = burnAbort.signal
      const onProgress = (ratio: number): void => {
        // once cancelled, stop emitting — a late event would re-show the bar
        if (!sig.aborted && !sender(e).isDestroyed()) {
          sender(e).send('job:progress', { stage: 'burn', ratio })
        }
      }
      try {
        await burnCaptions(payload.videoPath, ass, filePath, onProgress, sig)
      } catch (err) {
        if (sig.aborted) {
          await rm(filePath, { force: true }).catch(() => {})
          return { canceled: true as const }
        }
        const code = (err as NodeJS.ErrnoException)?.code
        if (code && ['EACCES', 'EROFS', 'EPERM', 'ENOENT'].includes(code)) {
          filePath = pick(app.getPath('downloads'))
          await burnCaptions(payload.videoPath, ass, filePath, onProgress, sig)
        } else {
          throw err
        }
      } finally {
        burnAbort = null
      }
      return { canceled: false as const, filePath }
    },
  )

  ipcMain.handle('burn:cancel', () => {
    burnAbort?.abort()
  })

  ipcMain.handle('export:saveCopy', async (e, srcPath: string) => {
    const { canceled, filePath } = await saveDialog(e, {
      title: 'Save a copy',
      defaultPath: basename(srcPath),
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    })
    if (canceled || !filePath) return { canceled: true as const }
    if (filePath !== srcPath) await copyFile(srcPath, filePath)
    return { canceled: false as const, filePath }
  })

  ipcMain.handle('export:play', (_e, filePath: string) => shell.openPath(filePath))
  ipcMain.handle('export:share', (_e, filePath: string) => shareFile(filePath))
  ipcMain.handle('export:email', (_e, filePath: string) => emailFile(filePath))

  ipcMain.handle(
    'save:text',
    async (e, payload: { suggestedName: string; content: string }) => {
      const { canceled, filePath } = await saveDialog(e, {
        defaultPath: payload.suggestedName,
      })
      if (canceled || !filePath) return { canceled: true as const }
      await writeFile(filePath, payload.content, 'utf8')
      return { canceled: false as const, filePath }
    },
  )

  ipcMain.handle('reveal', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}
