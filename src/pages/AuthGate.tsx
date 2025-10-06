import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Login from '../components/Login'
import ProfileGate from '../components/ProfileGate'

export default function AuthGate() {
  const navigate = useNavigate()
  const envMissing =
    !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

  const [hasSession, setHasSession] = useState<boolean>(false)
  const [checkedOnce, setCheckedOnce] = useState(false)

  useEffect(() => {
    if (envMissing) return
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      setHasSession(!!data.session)
      setCheckedOnce(true)
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

  const goToGuest = () => {
    localStorage.setItem('appMode', 'guest')
    navigate('/app', { replace: true })
  }

  if (envMissing) {
    return (
      <div style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>編集者認証</h2>
        <div style={{ 
          padding: 16, 
          marginBottom: 16, 
          background: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: 12,
          color: '#92400e'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠️ 環境変数が設定されていません</div>
          <p style={{ margin: 0, fontSize: 14 }}>
            編集者ログインには Supabase の環境変数が必要です。
          </p>
        </div>
        
        <div style={{ 
          padding: 16, 
          background: '#f9fafb', 
          border: '1px solid #e5e7eb', 
          borderRadius: 12,
          marginBottom: 16
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>設定方法</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#374151' }}>
            <li><code>.env.production</code> ファイルを作成</li>
            <li><code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code> を設定</li>
            <li><code>npm run build</code> を実行してビルド</li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems:'center' }}>
          <Link to="/" style={{ textDecoration: 'underline' }}>← モード選択へ戻る</Link>
          <button
            onClick={goToGuest}
            style={{ 
              marginLeft: 'auto', 
              padding: '8px 12px', 
              borderRadius: 10, 
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontWeight: 700
            }}
          >
            閲覧で入る
          </button>
        </div>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ padding: 16 }}>
          <Link to="/" style={{ textDecoration: 'underline' }}>← モード選択へ戻る</Link>
        </div>
        
        <div style={{
          padding: 16,
          margin: '0 16px 16px',
          background: '#e0f2fe',
          border: '1px solid #bae6fd',
          borderRadius: 12,
          color: '#075985'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📝 編集者としてログイン</div>
          <p style={{ margin: 0, fontSize: 14 }}>
            編集権限を申請するには、メールアドレスでログインしてください。
            <br />
            ログイン後、管理者が権限を付与すると編集が可能になります。
          </p>
        </div>

        <Login />
      </div>
    )
  }

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
      <div style={{ 
        textAlign: 'center',
        padding: 24,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        maxWidth: 400
      }}>
        <div style={{ 
          width: 48, 
          height: 48, 
          margin: '0 auto 16px',
          background: '#dcfce7',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24
        }}>
          ✓
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>ログイン完了</div>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
          {displayName} としてログインしました。
          <br />
          編集権限は管理者が付与します。
        </p>
        <button
          onClick={finishEditorMode}
          style={{ 
            width: '100%',
            padding: '12px 14px', 
            borderRadius: 12, 
            background: '#e0f2fe', 
            border: '1px solid #bae6fd', 
            color: '#075985', 
            fontWeight: 800,
            marginBottom: 8
          }}
        >
          編集者モードで入る
        </button>
        <button
          onClick={goToGuest}
          style={{ 
            width: '100%',
            fontSize: 12, 
            color: '#6b7280', 
            textDecoration: 'underline', 
            background: 'transparent', 
            border: 'none',
            padding: '8px'
          }}
        >
          閲覧モードで入る
        </button>
      </div>
    </div>
  )
}