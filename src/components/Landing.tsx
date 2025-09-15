// src/components/Landing.tsx
import { useEffect, useState } from 'react'

export default function Landing({
  onEditor,
  onGuest
}:{ onEditor: ()=>void; onGuest:(name:string)=>void }) {
  const [name, setName] = useState('')

  useEffect(()=> {
    const saved = localStorage.getItem('displayName')
    if (saved) setName(saved)
  }, [])

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-orange-50 to-white">
      <div className="w-full max-w-md p-6 rounded-3xl shadow bg-white">
        <h1 className="text-3xl font-extrabold text-orange-600 text-center mb-6">
          Orchestra Notes
        </h1>

        <div className="space-y-3">
          <button
            onClick={onEditor}
            className="w-full rounded-2xl px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white shadow"
          >
            編集者として入る
          </button>

          <div className="text-center text-sm text-gray-400">または</div>

          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="表示名（例: たむら）"
            value={name}
            onChange={e=>setName(e.target.value)}
          />
          <button
            onClick={()=>{
              const n = (name || 'Guest').trim()
              localStorage.setItem('displayName', n)
              onGuest(n)
            }}
            className="w-full rounded-2xl px-6 py-3 border border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            ゲストとして閲覧する（編集不可）
          </button>
        </div>

        <p className="mt-4 text-xs text-gray-500 text-center">
          ※ゲストは名前のみで閲覧可能です。編集にはログインが必要です。
        </p>
      </div>
    </div>
  )
}
