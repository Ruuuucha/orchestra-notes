// src/App.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Landing from './components/Landing'
import ProfileGate from './components/ProfileGate'
import InviteEditor from './components/InviteEditor'
import SelectorBar from './components/SelectorBar'
import NotesList from './components/NotesList'
import EditorGate from './components/EditorGate'
import {
  ORCH_PARTS,
  DEFAULT_STATE,
  type AppState, type Concert, type Piece, type Note
} from './constants'
import './App.css'

type Me = { userId:string; email:string; displayName:string }

// ---- ユーティリティ ----
const newId = (prefix:string) => `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now()}`

// 旧データ → 新データへマイグレーション
function migrateShape(raw:any): AppState {
  const base: AppState | any = raw?.concerts ? raw : DEFAULT_STATE
  const next: AppState = { concerts: [] }

  for (const c of (base.concerts ?? [])) {
    const nc: Concert = {
      id: c.id ?? newId('c'),
      title: c.title ?? 'Concert',
      pieces: []
    }

    for (const pAny of (c.pieces ?? [])) {
      const p = pAny as any // ← ここを any として扱う

      // 旧: p.notes[] / 新: p.parts[].notes[]
      let parts = p.parts as any[] | undefined
      if (!parts) {
        const oldNotes: Note[] = (p.notes ?? []) as Note[]  // ← p.notes に触れるのはここだけ
        const mapped = Array.from(ORCH_PARTS, (name) => ({
          name,
          notes: oldNotes.filter((n: any) => n?.part ? n.part === name : false)
        }))
        // 「part の無い旧ノート」は Vn1 に寄せる
        const rest = oldNotes.filter((n: any) => !n?.part)
        if (rest.length) {
          const vn1 = mapped.find(x => x.name === 'Vn1')
          if (vn1) vn1.notes.push(...rest)
        }
        parts = mapped
      } else {
        // parts はあるが ORCH_PARTS を満たすよう補完
        const names = new Set(parts.map((x:any) => x.name))
        for (const name of ORCH_PARTS) {
          if (!names.has(name)) parts.push({ name, notes: [] })
        }
      }

      const np: Piece = {
        id: p.id ?? newId('p'),
        title: p.title ?? 'Piece',
        parts: parts as any
      }
      nc.pieces.push(np)
    }

    if (nc.pieces.length === 0) {
      nc.pieces.push({
        id: newId('p'),
        title: '曲A（サンプル）',
        parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
      })
    }

    next.concerts.push(nc)
  }

  if (next.concerts.length === 0) next.concerts = DEFAULT_STATE.concerts
  return next
}


export default function App() {
  // ランディング/ゲスト
  const [entered, setEntered] = useState(false)
  const [mode, setMode] = useState<'guest'|'editor'|null>(null)
  const [guestName, setGuestName] = useState<string|null>(null)

  // 認証/プロフィール
  const [session, setSession] = useState<boolean | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  // データ
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // 選択
  const [selectedConcertId, setSelectedConcertId] = useState<string>('c1')
  const [selectedPieceId, setSelectedPieceId] = useState<string>('p1')
  const [selectedPart, setSelectedPart] = useState<string>(ORCH_PARTS[0])

  const envMissing = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
  if (envMissing) {
    return <div style={{padding:16}}>
      <h3>設定エラー</h3>
      <p>Supabase の環境変数が未設定です。管理者へ連絡してください。</p>
    </div>
  }

  // セッション監視（ゲストなら不要）
  useEffect(() => {
    if (guestName) return
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(!!sess))
    return () => sub.subscription.unsubscribe()
  }, [guestName])

  // データ読み込み
  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: s } = await supabase.from('sets')
        .select('data').eq('slug','default-sample').maybeSingle()
      const migrated = migrateShape(s?.data ?? DEFAULT_STATE)
      setState(migrated)

      // 初期選択の整合
      const c0 = migrated.concerts[0]
      setSelectedConcertId(c0.id)
      const p0 = c0.pieces[0]
      setSelectedPieceId(p0.id)

      // 権限判定（ログイン時のみ）
      if (me) {
        const { data: editors } = await supabase.from('allowed_editors')
          .select('email').eq('set_slug','default-sample')
        setCanEdit(!!editors?.some(e => e.email === me.email))
      } else {
        setCanEdit(false)
      }
      setLoading(false)
    })()
  }, [me, guestName])

  const currentConcert = useMemo(
    () => state.concerts.find(c=>c.id===selectedConcertId) ?? state.concerts[0],
    [state, selectedConcertId]
  )
  const currentPiece = useMemo(
    () => currentConcert.pieces.find(p=>p.id===selectedPieceId) ?? currentConcert.pieces[0],
    [currentConcert, selectedPieceId]
  )
  const currentPart = useMemo(
    () => currentPiece.parts.find(pt=>pt.name===selectedPart) ?? currentPiece.parts[0],
    [currentPiece, selectedPart]
  )

  const saveState = async (next: AppState) => {
    setState(next)
    const { error } = await supabase.from('sets')
      .update({ data: next }).eq('slug','default-sample')
    if (error) alert(error.message)
  }

  // ノート追加（選択パートに）
  const addNote = async (partial: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>) => {
    if (!canEdit || !me) return
    const n: Note = {
      ...partial,
      id: crypto.randomUUID(),
      authorName: me.displayName,
      authorEmail: me.email,
      createdAt: new Date().toISOString()
    }
    const next = structuredClone(state)
    const c = next.concerts.find(c=>c.id===currentConcert.id)!
    const p = c.pieces.find(p=>p.id===currentPiece.id)!
    const pt = p.parts.find(pt=>pt.name===selectedPart)!
    pt.notes.push(n)
    await saveState(next)
  }

  // 演奏会追加（簡易）
  const addConcert = async () => {
    if (!canEdit) return
    const title = window.prompt('演奏会名を入力')?.trim()
    if (!title) return
    const cId = newId('c')
    const next = structuredClone(state)
    next.concerts.push({
      id: cId,
      title,
      pieces: [{
        id: newId('p'),
        title: '新しい曲',
        parts: Array.from(ORCH_PARTS, (name)=>({ name, notes: [] }))
      }]
    })
    await saveState(next)
    setSelectedConcertId(cId)
  }

  // 曲追加（選択演奏会に）
  const addPiece = async () => {
    if (!canEdit) return
    const title = window.prompt('曲名を入力')?.trim()
    if (!title) return
    const next = structuredClone(state)
    const c = next.concerts.find(c=>c.id===currentConcert.id)!
    const pId = newId('p')
    c.pieces.push({
      id: pId,
      title,
      parts: Array.from(ORCH_PARTS, (name)=>({ name, notes: [] }))
    })
    await saveState(next)
    setSelectedPieceId(pId)
  }

  // ===== 画面分岐 =====
  if (!entered) {
    return (
      <Landing
        onEditor={()=>{ setMode('editor'); setEntered(true) }}
        onGuest={(n)=>{ setMode('guest'); setGuestName(n); setEntered(true) }}
      />
    )
  }
  // ===== 編集者入口（申請 or ログイン） =====
  if (mode === 'editor' && !session) {
    // まだログインしていない時は EditorGate を表示
    return <EditorGate onDone={() => { setEntered(false); setMode(null) }} />
  }
  // ===== ゲスト入口 =====
  if (mode === 'guest') {
    // （あなたの現状のゲスト表示ロジックをそのまま）
    // currentPart.notes を使った閲覧UI
    // ...
  }

  if (guestName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        <SelectorBar
          concerts={state.concerts}
          selectedConcertId={currentConcert.id}
          selectedPieceId={currentPiece.id}
          selectedPart={selectedPart}
          onChangeConcert={setSelectedConcertId}
          onChangePiece={setSelectedPieceId}
          onChangePart={setSelectedPart}
          onAddConcert={()=>{}}
          onAddPiece={()=>{}}
          canEdit={false}
        />
        <div className="max-w-5xl mx-auto p-4">
          <Header title={`${currentConcert.title} / ${currentPiece.title}`} right={`${guestName}（閲覧専用）`} />
          {loading ? <p>読み込み中…</p> : (
            <NotesList notes={currentPart.notes} canEdit={false} onAdd={()=>{}} />
          )}
        </div>
      </div>
    )
  }
  if (session === null) return null
  if (!session) return <Login />
  if (session && !me) {
    return <ProfileGate onReady={(p)=>{ localStorage.setItem('displayName', p.displayName); setMe(p) }} />
  }

  // ログイン済み（編集者判定込み）
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <SelectorBar
        concerts={state.concerts}
        selectedConcertId={currentConcert.id}
        selectedPieceId={currentPiece.id}
        selectedPart={selectedPart}
        onChangeConcert={setSelectedConcertId}
        onChangePiece={setSelectedPieceId}
        onChangePart={setSelectedPart}
        onAddConcert={addConcert}
        onAddPiece={addPiece}
        canEdit={canEdit}
      />
      <div className="max-w-5xl mx-auto p-4">
        <Header title={`${currentConcert.title} / ${currentPiece.title}`} right={`${me!.displayName}（${canEdit?'編集可':'閲覧専用'}）`} />
        {canEdit && (
          <div className="mb-3">
            <InviteEditor setSlug="default-sample" />
          </div>
        )}
        {loading ? <p>読み込み中…</p> : (
          <NotesList notes={currentPart.notes} canEdit={canEdit} onAdd={addNote} />
        )}
      </div>
    </div>
  )
}

function Header({ title, right }:{ title:string; right:string }) {
  return (
    <header className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-2xl font-bold text-orange-700">{title}</h1>
        <p className="text-sm text-gray-600">Orchestra Notes</p>
      </div>
      <div className="text-sm text-gray-700">{right}</div>
    </header>
  )
}
