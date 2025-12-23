import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  // 申請フォーム（折りたたみ）
  const [reqOpen, setReqOpen] = useState(false)
  const [reqEmail, setReqEmail] = useState('')
  const [reqMsg, setReqMsg] = useState('')
  const [reqDone, setReqDone] = useState(false)

  const sendMagicLink = async () => {
    const target = email.trim()
    if (!target) return
    
    // ★ 修正箇所: HashRouter用に #/auth を含める
    const redirectUrl = import.meta.env.DEV
      ? 'http://localhost:5173/orchestra-notes/#/auth'
      : 'https://ruuuucha.github.io/orchestra-notes/#/auth'
    
    const { error } = await supabase.auth.signInWithOtp({
      email: target,
      options: {
        emailRedirectTo: redirectUrl
      }
    })
    if (error) {
      console.error('[Auth] signInWithOtp error:', error)
      alert(error.message)
    } else {
      setSent(true)
    }
  }

  const sendRequest = async () => {
    const e = reqEmail.trim()
    if (!e) return
    const { error } = await supabase.from('edit_requests').insert({
      email: e,
      message: reqMsg
    })
    if (error) {
      alert(error.message)
    } else {
      setReqDone(true)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-orange-50 to-white">
      <div className="w-full max-w-md p-6 rounded-3xl shadow bg-white">
        <h1 className="text-2xl font-extrabold text-orange-600 text-center mb-4">
          編集ログイン
        </h1>

        {sent ? (
          <p className="text-center">メールを送信しました。リンクから戻ってきてください。</p>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-2">ログイン（メールリンク）</h2>
            <input
              className="w-full border rounded-xl px-3 py-2 mb-3"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e=>setEmail(e.target.value)}
            />
            <button
              onClick={sendMagicLink}
              className="w-full rounded-2xl px-4 py-3 bg-orange-500 text-white hover:bg-orange-600"
            >
              送信
            </button>
          </>
        )}

        <div className="my-5 h-px bg-gray-200" />

        {/* 申請（小さく置く） */}
        <button
          onClick={()=>setReqOpen(v=>!v)}
          className="w-full text-sm text-gray-600 underline"
        >
          {reqOpen ? '編集権限の申請を閉じる' : '編集権限を申請する'}
        </button>

        {reqOpen && (
          <div className="mt-3 p-3 rounded-2xl border bg-orange-50 border-orange-200">
            {reqDone ? (
              <p className="text-sm">申請を受け付けました。承認後に編集できるようになります。</p>
            ) : (
              <>
                <input
                  className="w-full border rounded-xl px-3 py-2 mb-2"
                  type="email"
                  placeholder="your@email.com"
                  value={reqEmail}
                  onChange={e=>setReqEmail(e.target.value)}
                />
                <textarea
                  className="w-full border rounded-xl px-3 py-2 mb-2"
                  rows={3}
                  placeholder="所属や用途など（任意）"
                  value={reqMsg}
                  onChange={e=>setReqMsg(e.target.value)}
                />
                <button
                  onClick={sendRequest}
                  className="w-full rounded-2xl px-4 py-2 border border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  申請を送信
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}