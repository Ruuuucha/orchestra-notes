import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import NotesRoot from './pages/NotesRoot'
import SheetPage from './pages/SheetPage'
import PracticePage from './pages/PracticePage'
import AuthGate from './pages/AuthGate'

/**
 * 要件：
 * - URLを開いた直後は「閲覧 or 編集」の選択"だけ"を見せる
 * - 閲覧を選ぶ → 3アプリのランチャー（App Hub）へ
 * - 編集を選ぶ → ログイン/申請（AuthGate）→ ランチャーへ
 * - 閲覧モードでは Sheet の追加など編集系は不可（各ページ側で appMode=guest を見て無効化済）
 */

function ModeSelect() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<string | null>(null)

  // 初回表示は「選択だけ」。選んだらランチャーへ。
  const chooseGuest = () => {
    localStorage.setItem('appMode', 'guest')
    setMode('guest')
    navigate('/app', { replace: true })
  }
  const chooseEditor = () => {
    // 編集はまず認証へ
    navigate('/auth')
  }

  // モードが既に選ばれていたら（再訪問時など）そのままランチャーへ
  useEffect(() => {
    const saved = localStorage.getItem('appMode')
    if (saved === 'guest') navigate('/app', { replace: true })
    // editor は認証状態もあるので /auth へ誘導
    if (saved === 'editor') navigate('/app', { replace: true })
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', display:'grid', placeItems:'center', background:'#f9fafb', padding:24 }}>
      <div style={{
        width:'100%', maxWidth: 560, background:'#fff', border:'1px solid #e5e7eb',
        borderRadius:16, padding:20
      }}>
        <h1 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>Orchestra App</h1>
        <p style={{ color:'#6b7280', marginBottom:16 }}>はじめにモードを選んでください。</p>

        <div style={{ display:'grid', gap:10 }}>
          <button
            onClick={chooseEditor}
            style={{
              padding:'12px 14px', borderRadius:12,
              background:'#e0f2fe', border:'1px solid #bae6fd',
              color:'#075985', fontWeight:800
            }}
          >
            編集者として入る（ログイン/申請）
          </button>
          <button
            onClick={chooseGuest}
            style={{
              padding:'12px 14px', borderRadius:12,
              background:'#f3f4f6', border:'1px solid #e5e7eb',
              color:'#374151', fontWeight:800
            }}
          >
            閲覧で入る（編集不可）
          </button>
        </div>

        <div style={{ marginTop:12, fontSize:12, color:'#6b7280' }}>
          ※ 編集可否は後から「/app」の右上バッジで変更できます。
        </div>
      </div>
    </div>
  )
}

function AppHub() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<string | null>(localStorage.getItem('appMode'))

  const open = (to: string) => {
    if (!mode) {
      alert('先に「閲覧」または「編集」を選んでください。')
      return
    }
    console.log('Navigating to:', to)
    navigate(to)
  }

  const changeMode = () => {
    localStorage.removeItem('appMode')
    setMode(null)
    navigate('/', { replace: true })
  }

  const label = mode === 'editor' ? '編集モード' : mode === 'guest' ? '閲覧モード' : '未選択'
  const bg = mode === 'editor' ? '#dcfce7' : mode === 'guest' ? '#e5e7eb' : '#ffe4e6'
  const fg = mode === 'editor' ? '#065f46' : mode === 'guest' ? '#374151' : '#9f1239'

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', padding:24 }}>
      <div style={{ maxWidth:960, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <h1 style={{ fontSize:26, fontWeight:800, margin:0 }}>Orchestra App</h1>
          <div style={{ marginLeft:'auto' }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 10px',
              borderRadius:999, background:bg, color:fg, fontWeight:700 }}>
              {label}
              <button
                onClick={changeMode}
                style={{ border:'1px solid #e5e7eb', background:'#fff', borderRadius:8, padding:'2px 8px', fontWeight:700 }}
              >
                変更
              </button>
            </span>
          </div>
        </div>

        <p style={{ color:'#6b7280', marginBottom:16 }}>モジュールを選択してください。</p>

        <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <button
            onClick={() => open('/notes')}
            style={{ 
              display:'block', 
              borderRadius:16, 
              border:'1px solid #e5e7eb', 
              padding:16, 
              background:'#fff', 
              textDecoration:'none', 
              color:'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Orchestra Notes</div>
            <div style={{ color:'#6b7280', fontSize:14 }}>曲・パートごとの注意点（従来UI）</div>
          </button>

          <button
            onClick={() => open('/sheet')}
            style={{ 
              display:'block', 
              borderRadius:16, 
              border:'1px solid #e5e7eb', 
              padding:16, 
              background:'#fff', 
              textDecoration:'none', 
              color:'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Orchestra Sheet</div>
            <div style={{ color:'#6b7280', fontSize:14 }}>スコア/音源・パート譜・ボウイングのリンク</div>
          </button>

          <button
            onClick={() => open('/practice')}
            style={{ 
              display:'block', 
              borderRadius:16, 
              border:'1px solid #e5e7eb', 
              padding:16, 
              background:'#fff', 
              textDecoration:'none', 
              color:'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>Orchestra Practice</div>
            <div style={{ color:'#6b7280', fontSize:14 }}>練習会：日程/時間/会場 → パート → 座席</div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 1. 最初に必ずモード選択（閲覧/編集） */}
        <Route path="/" element={<ModeSelect />} />

        {/* 2. 編集者は /auth でログイン/申請（完了時に localStorage.appMode='editor' をセットして /app へ） */}
        <Route path="/auth" element={<AuthGate />} />

        {/* 3. ランチャー（ここから各アプリへ分岐） */}
        <Route path="/app" element={<AppHub />} />

        {/* 4. 各アプリ */}
        <Route path="/notes" element={<NotesRoot />} />
        <Route path="/sheet" element={<SheetPage />} />
        <Route path="/practice" element={<PracticePage />} />

        {/* 迷子はトップ（選択画面）へ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}