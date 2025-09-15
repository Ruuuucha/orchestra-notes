// src/components/EditorGate.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Login from './Login'

export default function EditorGate({ onDone }:{ onDone: ()=>void }) {
  const [tab, setTab] = useState<'request'|'login'>('request')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const requestAccess = async () => {
    const e = email.trim()
    if (!e) return
    const { error } = await supabase.from('edit_requests').insert({ email: e, message })
    if (error) alert(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-orange-50 to-white">
      <div className="w-full max-w-md p-6 rounded-3xl shadow bg-white">
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 rounded-xl px-3 py-2 border ${tab==='request' ? 'bg-orange-500 text-white border-orange-500' : 'hover:bg-orange-50'}`}
            onClick={()=>setTab('request')}
          >編集権限を申請</button>
          <button
            className={`flex-1 rounded-xl px-3 py-2 border ${tab==='login' ? 'bg-orange-500 text-white border-orange-500' : 'hover:bg-orange-50'}`}
            onClick={()=>setTab('login')}
          >ログインして編集</button>
        </div>

        {tab === 'request' ? (
          sent ? (
            <div className="text-center">
              <p className="mb-2">申請を受け付けました。</p>
              <button className="rounded-xl px-4 py-2 bg-orange-500 text-white" onClick={onDone}>
                戻る
              </button>
            </div>
          ) : (
            <>
              <input
                className="w-full border rounded-xl px-3 py-2 mb-2"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e=>setEmail(e.target.value)}
              />
              <textarea
                className="w-full border rounded-xl px-3 py-2 mb-2"
                rows={3}
                placeholder="所属や用途など（任意）"
                value={message}
                onChange={e=>setMessage(e.target.value)}
              />
              <button
                onClick={requestAccess}
                className="w-full rounded-2xl px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white"
              >
                申請を送信
              </button>
              <p className="text-xs text-gray-500 mt-2">
                送信後、管理者が承認すると編集できるようになります。
              </p>
            </>
          )
        ) : (
          // 既存のメールログイン（Magic Link）
          <Login />
        )}
      </div>
    </div>
  )
}
