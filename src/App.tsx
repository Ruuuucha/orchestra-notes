import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Landing from './components/Landing'
import ProfileGate from './components/ProfileGate'
import InviteEditor from './components/InviteEditor'
import { ORCH_PARTS, DEFAULT_STATE } from './constants'
import './App.css'

type Note = {
  id: string
  part: string
  measureFrom: number
  measureTo: number
  text: string
  authorName?: string      // 表示用
  authorEmail?: string     // 権限判定のみ
  createdAt: string
}
type Piece = { id:string; title:string; notes: Note[] }
type Concert = { id:string; title:string; pieces: Piece[] }
type AppState = { concerts: Concert[] }
type Me = { userId: string; email: string; displayName: string }

export default function App() {
  // 画面制御
  const [entered, setEntered] = useState(false)          // ランディング→本体へ
  const [guestName, setGuestName] = useState<string| null>(null) // ゲスト閲覧モード
  const [session, setSession] = useState<boolean | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  // データ
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // セッション監視（ゲストモード時は不要）
  useEffect(() => {
    if (guestName) return
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setSession(!!sess)
    )
    return () => sub.subscription.unsubscribe()
  }, [guestName])

  // データ読み込み
  useEffect(() => {
    (async () => {
      if (!me && !guestName) { setLoading(false); return }
      setLoading(true)

      // sets を取得（ゲストも読み取りOK）
      const { data: s } = await supabase
        .from('sets')
        .select('data')
        .eq('slug','default-sample')
        .maybeSingle()
      if (s?.data) setState(s.data as AppState)
      else setState(DEFAULT_STATE)

      // 編集権限判定（ログイン時のみ）
      if (me) {
        const { data: editors } = await supabase
          .from('allowed_editors')
          .select('email')
          .eq('set_slug','default-sample')
        setCanEdit(!!editors?.some(e => e.email === me.email))
      } else {
        setCanEdit(false)
      }

      setLoading(false)
    })()
  }, [me, guestName])

  const piece = useMemo(() => state.concerts[0].pieces[0], [state])

  const saveState = async (next: AppState) => {
    setState(next)
    const { error } = await supabase
      .from('sets')
      .update({ data: next })
      .eq('slug','default-sample')
    if (error) alert(error.message)
  }

  const addNote = async (partial: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>) => {
    if (!canEdit || !me) return
    const n: Note = {
      ...partial,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      authorName: me.displayName,
      authorEmail: me.email,
    }
    const next = structuredClone(state)
    next.concerts[0].pieces[0].notes.push(n)
    await saveState(next)
  }

  // ===== 画面分岐 =====
  if (!entered) {
    return (
      <Landing
        onEnter={() => setEntered(true)}
        onGuest={(n) => { setGuestName(n); setEntered(true) }}
      />
    )
  }

  // ゲスト閲覧モード
  if (guestName) {
    return (
      <Viewer
        displayName={guestName}
        piece={piece}
        loading={loading}
      />
    )
  }

  // ログインフロー
  if (session === null) return null
  if (!session) return <Login />
  if (session && !me) {
    return (
      <ProfileGate onReady={(p) => {
        localStorage.setItem('displayName', p.displayName)
        setMe(p)
      }}/>
    )
  }

  // ログイン済み本体UI
  return (
    <Editor
      me={me!}
      canEdit={canEdit}
      loading={loading}
      piece={piece}
      addNote={addNote}
    />
  )
}

/* ===== サブコンポーネント ===== */

// 閲覧専用ビュー
function Viewer({ displayName, piece, loading }:{
  displayName: string
  piece: Piece
  loading: boolean
}) {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Default-Sample</h1>
          <p className="text-sm text-gray-500">Orchestra Notes</p>
        </div>
        <div className="text-sm text-gray-600">{displayName}（閲覧専用）</div>
      </header>

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <NotesList piece={piece} />
      )}
    </div>
  )
}

// 編集者ビュー
function Editor({ me, canEdit, loading, piece, addNote }:{
  me: Me
  canEdit: boolean
  loading: boolean
  piece: Piece
  addNote: (p: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>) => void
}) {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Default-Sample</h1>
          <p className="text-sm text-gray-500">Orchestra Notes</p>
        </div>
        <div className="text-sm text-gray-600">
          {me.displayName}（{canEdit ? '編集可' : '閲覧専用'}）
        </div>
      </header>

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          {canEdit && (
            <div className="mb-4">
              <InviteEditor setSlug="default-sample" />
            </div>
          )}
          {canEdit && <AddNoteForm onAdd={addNote} />}
          <NotesList piece={piece} />
        </>
      )}
    </div>
  )
}

// ノート一覧
function NotesList({ piece }:{ piece: Piece }) {
  return (
    <section className="mt-6 space-y-3">
      <h2 className="font-semibold mb-2">ノート一覧</h2>
      {piece.notes.length === 0 ? (
        <p className="text-gray-500">まだノートはありません。</p>
      ) : piece.notes.map(n => (
        <article key={n.id} className="p-3 rounded-xl border bg-white">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold">
              {n.part} ｜ {n.measureFrom}–{n.measureTo}小節
            </div>
            <div className="text-xs text-gray-500">by {n.authorName}</div>
          </div>
          <p className="whitespace-pre-wrap">{n.text}</p>
        </article>
      ))}
    </section>
  )
}

// ノート追加フォーム
function AddNoteForm({ onAdd }:{
  onAdd:(p: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>)=>void
}) {
  const [part, setPart] = useState<string>(ORCH_PARTS[0])
  const [from, setFrom] = useState<number>(1)
  const [to, setTo] = useState<number>(1)
  const [text, setText] = useState<string>('')

  const submit = () => {
    if (!text.trim()) return
    onAdd({ part, measureFrom: from, measureTo: to, text })
    setText('')
  }

  return (
    <div className="p-4 rounded-2xl border bg-white">
      <h3 className="font-semibold mb-2">ノート追加</h3>
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm">パート</label>
        <select
          className="border rounded px-2 py-1"
          value={part}
          onChange={e=>setPart(e.target.value)}
        >
          {ORCH_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="ml-3 text-sm">小節</label>
        <input
          type="number" min={1}
          className="w-24 border rounded px-2 py-1"
          value={from}
          onChange={e=>setFrom(parseInt(e.target.value || '1'))}
        />
        <span>–</span>
        <input
          type="number" min={1}
          className="w-24 border rounded px-2 py-1"
          value={to}
          onChange={e=>setTo(parseInt(e.target.value || '1'))}
        />
      </div>
      <textarea
        className="mt-2 w-full border rounded px-3 py-2"
        rows={3}
        placeholder="自由メモ"
        value={text}
        onChange={e=>setText(e.target.value)}
      />
      <div className="mt-2 text-right">
        <button
          onClick={submit}
          className="rounded-xl px-4 py-2 bg-violet-600 text-white"
        >
          追加
        </button>
      </div>
    </div>
  )
}
