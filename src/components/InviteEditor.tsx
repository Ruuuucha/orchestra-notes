import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InviteEditor({ setSlug = 'default-sample' }:{ setSlug?: string }) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!email.trim()) return
    setBusy(true); setMsg(null)
    const { error } = await supabase
      .from('allowed_editors')
      .insert({ set_slug: setSlug, email: email.trim() })
    if (error) setMsg(`追加に失敗: ${error.message}`)
    else { setMsg(`追加しました：${email.trim()}`); setEmail('') }
    setBusy(false)
  }

  return (
    <div className="p-4 rounded-2xl border bg-white">
      <h3 className="font-semibold mb-2">編集者を追加</h3>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder="user@example.com"
          value={email}
          onChange={e=>setEmail(e.target.value)}
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-xl px-4 py-2 bg-violet-600 text-white disabled:opacity-50"
        >
          追加
        </button>
      </div>
      {msg && <p className="text-sm text-gray-600 mt-2">{msg}</p>}
      <p className="text-xs text-gray-500 mt-1">
        ＊あなたがオーナーまたは既存編集者なら、サーバ側ポリシーにより追加が許可されます。
      </p>
    </div>
  )
}
