import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!email.trim() || loading) return
    setLoading(true)

    // 本番は GitHub Pages のサブパスに合わせる
    const redirectTo = import.meta.env.DEV
      ? 'http://localhost:5173'
      : 'https://ruuuucha.github.io/orchestra-notes'

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      })
      if (error) {
        console.error('[Auth] signInWithOtp error:', error)
        alert(error.message)
      } else {
        setSent(true)
      }
    } catch (e) {
      console.error('[Auth] fetch failed:', e)
      alert('通信エラー（Failed to fetch）。環境変数やURL設定を確認してください。')
    } finally {
      setLoading(false)
    }
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
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              onClick={send}
              disabled={loading || !email.trim()}
              className="w-full rounded-xl px-4 py-2 bg-violet-600 text-white disabled:opacity-50"
            >
              {loading ? '送信中…' : '送信'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
