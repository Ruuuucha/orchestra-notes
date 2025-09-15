import { useEffect, useState } from 'react'

export default function Landing({ onEnter, onGuest }:{
  onEnter: ()=>void
  onGuest: (displayName: string)=>void
}) {
  const [name, setName] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('displayName')
    if (saved) setName(saved)
  }, [])

  const enterGuest = () => {
    const n = name.trim() || 'Guest'
    localStorage.setItem('displayName', n)
    onGuest(n)
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-md p-6 rounded-2xl shadow bg-white text-center">
        <h1 className="text-3xl font-bold mb-4">Orchestra Notes</h1>

        <button
          onClick={onEnter}
          className="w-full rounded-2xl px-6 py-3 bg-violet-600 text-white shadow hover:opacity-90"
        >
          Enter Orchestra Notes
        </button>

        <div className="my-4 text-gray-400 text-sm">または</div>

        <input
          className="w-full border rounded px-3 py-2 mb-2"
          placeholder="表示名（例: たむら）"
          value={name}
          onChange={e=>setName(e.target.value)}
        />
        <button
          onClick={enterGuest}
          className="w-full rounded-2xl px-6 py-3 border border-gray-300 hover:bg-gray-50"
        >
          名前だけで閲覧する（編集不可）
        </button>

        <p className="text-xs text-gray-500 mt-3">
          ※編集はログインが必要です（許可メールのみ編集可）
        </p>
      </div>
    </div>
  )
}
