import { app } from 'electron'
import { join } from 'node:path'

const osFolder =
  process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'

/** Directory holding the bundled whisper-cli and ffmpeg executables. */
export function binDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bin')
    : join(app.getAppPath(), 'resources', 'bin', osFolder)
}

/** Full path to a bundled executable, adding `.exe` on Windows. */
export function exe(name: string): string {
  return join(binDir(), process.platform === 'win32' ? `${name}.exe` : name)
}

/** Caption fonts libass reads (bundled fonts are copied here on first run,
 *  user-imported fonts land here too). Writable, survives app updates. */
export function fontsDir(): string {
  return join(app.getPath('userData'), 'fonts')
}

/** Read-only fonts shipped inside the app. */
export function bundledFontsDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'fonts')
    : join(app.getAppPath(), 'resources', 'fonts')
}

/** Where downloaded Whisper models are kept (survives app updates). */
export function modelsDir(): string {
  return join(app.getPath('userData'), 'models')
}

/** Saved projects live here, one folder per project. */
export function projectsDir(): string {
  return join(app.getPath('userData'), 'projects')
}

/** Scratch space for extracted audio and temp SRT files. */
export function scratchDir(): string {
  return join(app.getPath('temp'), 'auto-subtitles')
}
