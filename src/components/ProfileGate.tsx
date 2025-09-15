import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ProfileGate({ onReady }:{
  onReady:(p:{userId:string,email:string,displayName:string})=>void
}) {
  const [displayName, setDisplayName] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecking(false); return }
      const { data, error } = await supabase.from('profiles')
        .select('*').eq('user_id', user.id).maybeSingle()
      if (error) console.error(error)
      if (data) onReady({ userId:user.id, email:user.email!, displayName:data.display_name })
      else setChecking(false)
    })()
  }, [])

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').insert({
      user_id: user.id, email: user.email, display_name: displayName
    })
    if (error) alert(error.message)
    else onReady({ userId:user.id, email:user.email!, displayName })
  }

  if (checking) return null

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-sm p-6 rounded-2xl shadow bg-white">
        <h2 className="text-lg font-bold mb-2">表示名を設定</h2>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          placeholder="例: たむら"
          value={displayName} onChange={e=>setDisplayName(e.target.value)}
        />
        <button onClick={save} className="w-full rounded-xl px-4 py-2 bg-violet-600 text-white">
          保存
        </button>
      </div>
    </div>
  )
}
