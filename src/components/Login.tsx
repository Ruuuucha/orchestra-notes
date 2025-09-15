import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const send = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) alert(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="w-full max-w-sm p-6 rounded-2xl shadow bg-white">
        <h1 className="text-xl font-bold mb-3">ログイン（メールリンク）</h1>
        {sent ? (
          <p>メールを送信しました。リンクから戻ってきてください。</p>
        ) : (
          <>
            <input
              className="w-full border rounded px-3 py-2 mb-3"
              placeholder="you@example.com"
              value={email} onChange={e=>setEmail(e.target.value)}
            />
            <button onClick={send} className="w-full rounded-xl px-4 py-2 bg-violet-600 text-white">
              送信
            </button>
          </>
        )}
      </div>
    </div>
  )
}
