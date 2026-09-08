import { useRef, useState, type DragEvent } from 'react'

interface Props {
  onPick: (info: { path: string; name: string }) => void
}

export function Dropzone({ onPick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | undefined) => {
    if (!file) return
    onPick({ path: window.api.pathForFile(file), name: file.name })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    take(e.dataTransfer.files[0])
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-20 text-center transition ${
        over ? 'border-sky-400 bg-sky-400/10' : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
      }`}
    >
      <svg
        className="h-10 w-10 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V6m0 0-3.75 3.75M12 6l3.75 3.75M4.5 19.5h15" />
      </svg>
      <div className="text-lg font-medium text-slate-200">Drop a video here</div>
      <div className="text-sm text-slate-400">
        or click to choose &middot; MP4, MOV, MKV, WebM &middot; nothing leaves this machine
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </button>
  )
}
