import { useCallback, useEffect, useState } from 'react'
import type { ProjectSummary } from '@shared/project'

const rel = (ts: number): string => {
  const s = Math.max(0, (Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

export function HomeScreen({
  onOpen,
  onNew,
}: {
  onOpen: (id: string) => void
  onNew: () => void
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    window.api
      .listProjects()
      .then((p) => {
        setProjects(p)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])
  useEffect(refresh, [refresh])

  const del = async (id: string): Promise<void> => {
    await window.api.deleteProject(id)
    refresh()
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0b0f17]">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-2xl font-semibold text-white">Projects</h1>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
        >
          ＋ New project
        </button>
      </div>

      {loading ? null : projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
          <p>No projects yet.</p>
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Start one
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
              >
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="relative h-40 w-full bg-slate-950"
                >
                  {p.thumbPath ? (
                    <img
                      src={window.api.mediaUrl(p.thumbPath)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-slate-700">
                      ▶
                    </div>
                  )}
                  {p.missing && (
                    <span className="absolute top-1 left-1 rounded bg-rose-600/90 px-1.5 py-0.5 text-[10px] text-white">
                      video moved
                    </span>
                  )}
                </button>
                <div className="flex items-start justify-between gap-1 p-2">
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-slate-100">{p.name}</div>
                    <div className="truncate text-[11px] text-slate-500">
                      {p.lineCount} {p.lineCount === 1 ? 'line' : 'lines'} · {rel(p.updatedAt)}
                    </div>
                    <div className="truncate text-[10px] text-slate-600">{baseName(p.videoPath)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => del(p.id)}
                    title="Delete project"
                    className="rounded px-1.5 py-0.5 text-xs text-slate-500 opacity-0 hover:bg-slate-800 hover:text-rose-400 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
