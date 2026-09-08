import { useState, type ReactElement, type ReactNode } from 'react'

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

export function ExportModal({ path, onClose }: { path: string; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const save = (): Promise<void> =>
    run('save', async () => {
      const r = await window.api.saveExportCopy(path)
      if (!r.canceled) setNote(`Saved a copy: ${baseName(r.filePath)}`)
    })

  const share = (): Promise<void> =>
    run('share', async () => {
      const r = await window.api.shareExport(path)
      setNote(r.note ?? null)
    })

  const Btn = ({
    id,
    onClick,
    primary,
    span,
    children,
  }: {
    id: string
    onClick: () => void
    primary?: boolean
    span?: boolean
    children: ReactNode
  }): ReactElement => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
        span ? 'col-span-2 ' : ''
      }${
        primary
          ? 'bg-emerald-500 text-white hover:bg-emerald-400'
          : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {busy === id ? '…' : children}
    </button>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <span className="text-sm font-semibold text-white">Export ready</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <video
            src={window.api.mediaUrl(path)}
            controls
            autoPlay
            className="mb-2 max-h-[46vh] w-full rounded-lg bg-black"
          />
          <div className="mb-3 truncate text-xs text-slate-400">{baseName(path)}</div>

          <div className="grid grid-cols-2 gap-2">
            <Btn id="save" onClick={save} primary>
              Save to computer…
            </Btn>
            <Btn id="share" onClick={share}>
              {isMac ? 'Share (AirDrop…)' : 'Share…'}
            </Btn>
            <Btn id="email" onClick={() => window.api.emailExport(path)}>
              Email
            </Btn>
            <Btn id="play" onClick={() => window.api.playExport(path)}>
              Open in player
            </Btn>
            <Btn id="reveal" onClick={() => window.api.reveal(path)} span>
              {isMac ? 'Show in Finder' : 'Show in folder'}
            </Btn>
          </div>

          {note && <p className="mt-3 text-[11px] text-slate-400">{note}</p>}
          {!isMac && (
            <p className="mt-2 text-[11px] text-slate-500">
              AirDrop / WhatsApp / Drive sharing runs through the macOS build. On Windows, use{' '}
              <b>Show in folder</b> then the file’s own Share menu.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
