import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PROJECT_VERSION, type Project, type ProjectSummary } from '@shared/project'
import { exe, projectsDir } from './paths'

const INDEX = '_index.json'
const dir = (id: string): string => join(projectsDir(), id)
const jsonPath = (id: string): string => join(dir(id), 'project.json')
const thumbPath = (id: string): string => join(dir(id), 'thumb.jpg')
const indexPath = (): string => join(projectsDir(), INDEX)

/**
 * Known project ids, persisted alongside the folders. Windows directory
 * enumeration has been observed to intermittently omit a folder; keeping an
 * explicit index means a project that a single `readdir` misses still loads.
 */
async function readIndex(): Promise<string[]> {
  try {
    const j = JSON.parse(await readFile(indexPath(), 'utf8')) as { ids?: unknown }
    return Array.isArray(j.ids) ? j.ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function writeIndex(ids: string[]): Promise<void> {
  try {
    await mkdir(projectsDir(), { recursive: true })
    const tmp = `${indexPath()}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify({ ids: [...new Set(ids)] }), 'utf8')
    await rename(tmp, indexPath())
  } catch {
    /* index is a cache; losing it is not fatal */
  }
}

async function scanDirs(): Promise<string[]> {
  // two reads: a lone `readdir` on Windows can transiently drop an entry
  const tries = await Promise.allSettled([readdir(projectsDir()), readdir(projectsDir())])
  const names = new Set<string>()
  for (const t of tries) if (t.status === 'fulfilled') for (const n of t.value) names.add(n)
  return [...names].filter((n) => n !== INDEX && !n.endsWith('.tmp'))
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const candidates = new Set<string>([...(await scanDirs()), ...(await readIndex())])

  const out: ProjectSummary[] = []
  const keep: string[] = []
  for (const id of candidates) {
    try {
      const p = JSON.parse(await readFile(jsonPath(id), 'utf8')) as Project
      out.push({
        id: p.id,
        name: p.name,
        videoPath: p.videoPath,
        thumbPath: existsSync(thumbPath(id)) ? thumbPath(id) : null,
        updatedAt: p.updatedAt,
        missing: !existsSync(p.videoPath),
        lineCount: p.segments?.length ?? 0,
      })
      keep.push(id)
    } catch {
      // couldn't read it this time — keep it indexed if the folder is still
      // there (transient lock / enumeration miss); drop it only if truly gone
      if (existsSync(dir(id))) keep.push(id)
    }
  }
  await writeIndex(keep)
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadProject(id: string): Promise<Project | null> {
  try {
    return JSON.parse(await readFile(jsonPath(id), 'utf8')) as Project
  } catch {
    return null
  }
}

const thumbInFlight = new Set<string>()

async function makeThumb(id: string, videoPath: string): Promise<void> {
  if (thumbInFlight.has(id) || existsSync(thumbPath(id)) || !existsSync(videoPath)) return
  thumbInFlight.add(id)
  await new Promise<void>((resolve) => {
    const p = spawn(
      exe('ffmpeg'),
      ['-hide_banner', '-y', '-ss', '1', '-i', videoPath, '-frames:v', '1', '-vf', 'scale=320:-2', thumbPath(id)],
      { windowsHide: true },
    )
    p.on('error', () => resolve())
    p.on('close', () => resolve())
  })
  thumbInFlight.delete(id)
}

export async function saveProject(input: Project): Promise<{ id: string; updatedAt: number }> {
  const id = input.id || randomUUID()
  await mkdir(dir(id), { recursive: true })
  const now = Date.now()
  const project: Project = {
    ...input,
    v: PROJECT_VERSION,
    id,
    createdAt: input.createdAt || now,
    updatedAt: now,
  }
  // atomic write: a crash mid-write must not corrupt an existing project.json
  const tmp = `${jsonPath(id)}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(project), 'utf8')
  await rename(tmp, jsonPath(id))
  void writeIndex([...(await readIndex()), id])
  void makeThumb(id, project.videoPath)
  return { id, updatedAt: now }
}

export async function deleteProject(id: string): Promise<void> {
  await rm(dir(id), { recursive: true, force: true })
  void writeIndex((await readIndex()).filter((x) => x !== id))
}
