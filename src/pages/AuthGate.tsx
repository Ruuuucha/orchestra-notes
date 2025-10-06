import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Login from '../components/Login'
import ProfileGate from '../components/ProfileGate'

/**
 * 方針（待ち画面ナシ版）:
 * - env が無い時だけ案内を表示（編集者ログインは不可なので閲覧へ誘導）
 * - env がある時は「即」Loginを表示
 *   - 既にログイン済みだった場合は onAuthStateChange で真っ先に session=true になり、
 *     その瞬間に ProfileGate/完了UI に切り替わる。＝待ち画面を挟まない。
 */

export default function AuthGate() {
  const navigate = useNavigate()
  const envMissing =
    !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

  // 「即」レンダリング判断用
  const [hasSession, setHasSession] = useState<boolean>(false)
  const [checkedOnce, setCheckedOnce] = useState(false)

  useEffect(() => {
    if (envMissing) return
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      setHasSession(!!data.session)
      setCheckedOnce(true)
      // 以降の変化も即反映
      const sub = supabase.auth.onAuthStateChange((_e, s) => {
        setHasSession(!!s)
      })
      return () => sub.data.subscription.unsubscribe()
    })()
  }, [envMissing])

  const finishEditorMode = () => {
    localStorage.setItem('appMode', 'editor')
    navigate('/app', { replace: true })
  }

  if (envMissing) {
    // デモ/環境変数なし → 編集ログイン不可（以前の挙動に近い案内）
    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Auth</h2>
        <p style={{ color: '#6b7280', marginBottom: 12 }}>
          編集者ログインには Supabase の環境変数が必要です。<br />
          以前どおりの運用を行うには、<code>.env.production</code> に
          <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code> を設定して
          <code>npm run build</code> してください。
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
          <Link to="/" style={{ textDecoration: 'underline' }}>← モード選択へ戻る</Link>
          <button
            onClick={() => { localStorage.setItem('appMode', 'guest'); navigate('/app') }}
            style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 10, border: '1px solid #e5e7eb' }}
          >
            閲覧で入る
          </button>
        </div>
      </div>
    )
  }

  // ★ ここが肝：待ち画面を使わず、即レンダリング
  // 未ログイン扱い（hasSession=false）では常に Login を表示しておき、
  // すでにログイン済みだった場合だけ ProfileGate/完了にスッと切り替わる。

  if (!hasSession) {
    // 以前と同じ「メールリンクでログイン/新規」画面を即表示
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ padding: 16 }}>
          <Link to="/" style={{ textDecoration: 'underline' }}>← モード選択へ戻る</Link>
        </div>
        <Login />
      </div>
    )
  }

  // hasSession === true → 表示名が未登録なら ProfileGate、済なら完了UI
  const displayName = localStorage.getItem('displayName')
  if (!displayName) {
    return (
      <ProfileGate
        onReady={(p) => {
          localStorage.setItem('displayName', p.displayName)
          finishEditorMode()
        }}
      />
    )
  }

  return (
    <div className="min-h-screen grid place-items-center">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>ログイン完了</div>
        <button
          onClick={finishEditorMode}
          style={{ padding: '10px 14px', borderRadius: 12, background: '#e0f2fe', border: '1px solid #bae6fd', color: '#075985', fontWeight: 800 }}
        >
          編集モードで入る
        </button>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => { localStorage.setItem('appMode', 'guest'); navigate('/app') }}
            style={{ fontSize: 12, color: '#6b7280', textDecoration: 'underline', background: 'transparent', border: 'none' }}
          >
            閲覧で入る（編集は無効）
          </button>
        </div>
      </div>
    </div>
  )
}
