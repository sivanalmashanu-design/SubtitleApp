import { createReadStream } from 'node:fs'
import { basename, join } from 'node:path'
import { Readable } from 'node:stream'
import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { serveFile } from './media'
import { ensureFonts } from './fonts'
import { fontsDir } from './paths'

// Custom schemes: media:// plays user-chosen local video without disabling
// webSecurity; userfont:// serves imported font files to the preview.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, bypassCSP: true },
  },
  {
    scheme: 'userfont',
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true },
  },
])

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0f17',
    title: 'Auto Subtitles',
    // packaged builds get the icon from the .exe / .app bundle (electron-builder);
    // this only covers the dev window / taskbar entry.
    ...(is.dev ? { icon: join(import.meta.dirname, '../../build/icon.png') } : {}),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  // Give the renderer a chance to persist the open project before the window
  // goes away (autosave is debounced, so a fast close would otherwise lose it).
  let flushed = false
  win.on('close', (e) => {
    if (flushed || win.webContents.isDestroyed()) return
    e.preventDefault()
    let timer: NodeJS.Timeout
    const finish = (): void => {
      if (flushed) return
      flushed = true
      clearTimeout(timer)
      ipcMain.removeListener('app:flush-done', finish)
      if (!win.isDestroyed()) win.destroy()
    }
    ipcMain.once('app:flush-done', finish)
    timer = setTimeout(finish, 2000)
    win.webContents.send('app:flush')
  })

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sivan.autosubtitles')
  await ensureFonts()

  protocol.handle('media', (request) => serveFile(request))
  protocol.handle('userfont', (request) => {
    const name = basename(decodeURIComponent(new URL(request.url).pathname))
    try {
      return new Response(
        Readable.toWeb(createReadStream(join(fontsDir(), name))) as unknown as ReadableStream,
        { headers: { 'Content-Type': 'font/ttf' } },
      )
    } catch {
      return new Response('not found', { status: 404 })
    }
  })

  app.on('browser-window-created', (_e, window) => optimizer.watchWindowShortcuts(window))

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
