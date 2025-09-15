import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Landing from './components/Landing'
import ProfileGate from './components/ProfileGate'
import InviteEditor from './components/InviteEditor'
import Sidebar from './components/Sidebar'
import CategoryPicker from './components/CategoryPicker'
import PieceComments, { type PieceComment } from './components/PieceComments'
import { ORCH_PARTS, DEFAULT_STATE, NOTE_TEMPLATES } from './constants'
import './App.css'

// ===== Types =====
type Note = {
  id: string
  part: string
  measureFrom: number
  measureTo: number
  text: string
  categories: string[]
  authorName?: string
  authorEmail?: string
  createdAt: string
}
type Piece = { id:string; title:string; notes: Note[]; comments: PieceComment[] }
type Concert = { id:string; title:string; pieces: Piece[] }
type AppState = { concerts: Concert[] }
type Me = { userId: string; email: string; displayName: string }

export default function App() {
  // ランディング/ゲスト
  const [entered, setEntered] = useState(false)
  const [guestName, setGuestName] = useState<string| null>(null)

  // 認証/プロフィール
  const [session, setSession] = useState<boolean | null>(null)
  const [me, setMe] = useState<Me | null>(null)

  // データ
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // 選択中の演奏会/曲
  const [selectedConcertId, setSelectedConcertId] = useState('c1')
  const [selectedPieceId, setSelectedPieceId] = useState('p1')

  // セッション監視（ゲストなら不要）
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
      // ゲストでも読み取りOK
      setLoading(true)
      const { data: s } = await supabase
        .from('sets').select('data').eq('slug','default-sample').maybeSingle()
      if (s?.data) setState(s.data as AppState)
      else setState(DEFAULT_STATE)

      // 編集判定（ログイン時のみ）
      if (me) {
        const { data: editors } = await supabase
          .from('allowed_editors').select('email').eq('set_slug','default-sample')
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

  const saveState = async (next: AppState) => {
    setState(next)
    const { error } = await supabase.from('sets')
      .update({ data: next }).eq('slug','default-sample')
    if (error) alert(error.message)
  }

  // ノート追加
  const addNote = async (partial: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>) => {
    if (!canEdit || !me) return
    const n: Note = {
      ...partial,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      authorName: me.displayName,
      authorEmail: me.email
    }
    const next = structuredClone(state)
    const piece = next.concerts
      .find(c=>c.id===currentConcert.id)!.pieces
      .find(p=>p.id===currentPiece.id)!
    piece.notes.push(n)
    await saveState(next)
  }

  // 曲コメント追加
  const addPieceComment = async (text:string) => {
    if (!canEdit || !me) return
    const c: PieceComment = {
      id: crypto.randomUUID(),
      text,
      authorName: me.displayName,
      createdAt: new Date().toISOString()
    }
    const next = structuredClone(state)
    const piece = next.concerts
      .find(c=>c.id===currentConcert.id)!.pieces
      .find(p=>p.id===currentPiece.id)!
    if (!piece.comments) piece.comments = []
    piece.comments.push(c)
    await saveState(next)
  }

  // ===== 画面分岐 =====
  if (!entered) {
    return (
      <Landing
        onEnter={() => setEntered(true)}
        onGuest={(n)=>{ setGuestName(n); setEntered(true) }}
      />
    )
  }
  if (guestName) {
    return (
      <Shell
        left={<Sidebar
          concerts={state.concerts}
          selectedConcertId={currentConcert.id}
          selectedPieceId={currentPiece.id}
          onSelect={(cId,pId)=>{ setSelectedConcertId(cId); setSelectedPieceId(pId) }}
        />}
        right={<MainPane
          title={`${currentConcert.title} / ${currentPiece.title}`}
          displayName={`${guestName}（閲覧専用）`}
          canEdit={false}
          loading={loading}
          piece={currentPiece}
          onAddNote={()=>{}}
          onAddPieceComment={()=>{}}
        />}
      />
    )
  }
  if (session === null) return null
  if (!session) return <Login />
  if (session && !me) {
    return <ProfileGate onReady={(p)=>{
      localStorage.setItem('displayName', p.displayName)
      setMe(p)
    }} />
  }

  // ログイン済み
  return (
    <Shell
      left={<Sidebar
        concerts={state.concerts}
        selectedConcertId={currentConcert.id}
        selectedPieceId={currentPiece.id}
        onSelect={(cId,pId)=>{ setSelectedConcertId(cId); setSelectedPieceId(pId) }}
      />}
      right={<MainPane
        title={`${currentConcert.title} / ${currentPiece.title}`}
        displayName={`${me!.displayName}（${canEdit?'編集可':'閲覧専用'}）`}
        canEdit={canEdit}
        loading={loading}
        piece={currentPiece}
        onAddNote={(n)=>addNote(n)}
        onAddPieceComment={(t)=>addPieceComment(t)}
      />}
    />
  )
}

/* ===== レイアウト ===== */
function Shell({ left, right }:{ left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {left}
      <main className="flex-1 bg-gray-50">{right}</main>
    </div>
  )
}

/* ===== メインペイン ===== */
function MainPane({
  title, displayName, canEdit, loading, piece, onAddNote, onAddPieceComment
}:{
  title: string
  displayName: string
  canEdit: boolean
  loading: boolean
  piece: Piece
  onAddNote: (n: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>)=>void
  onAddPieceComment: (text:string)=>void
}) {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500">Orchestra Notes</p>
        </div>
        <div className="text-sm text-gray-600">{displayName}</div>
      </header>

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          {canEdit && <AddNoteForm onAdd={onAddNote} />}
          <NotesList piece={piece} />
          <PieceComments
            comments={piece.comments ?? []}
            canEdit={canEdit}
            onAdd={onAddPieceComment}
          />
        </>
      )}
    </div>
  )
}

/* ===== ノート一覧 ===== */
function NotesList({ piece }:{ piece: Piece }) {
  return (
    <section className="mt-6 space-y-3">
      <h3 className="font-semibold mb-2">ノート一覧</h3>
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
          {n.categories?.length > 0 && (
            <div className="mb-1 text-xs text-violet-700">
              {n.categories.join(' / ')}
            </div>
          )}
          <p className="whitespace-pre-wrap">{n.text}</p>
        </article>
      ))}
    </section>
  )
}

/* ===== ノート追加フォーム（カテゴリ付き） ===== */
function AddNoteForm({
  onAdd
}:{ onAdd:(n: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>)=>void }) {
  const [part, setPart] = useState<string>(ORCH_PARTS[0])
  const [from, setFrom] = useState<number>(1)
  const [to, setTo] = useState<number>(1)
  const [text, setText] = useState<string>('')
  const [categories, setCategories] = useState<string[]>([])

  const submit = () => {
    if (!text.trim()) return
    onAdd({ part, measureFrom: from, measureTo: to, text, categories })
    setText(''); setCategories([])
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

      <div className="mt-2">
        <CategoryPicker value={categories} onChange={setCategories} />
      </div>

      {/* テンプレボタン（自由メモに即挿入） */}
      <div className="mt-2 flex flex-wrap gap-2">
        {NOTE_TEMPLATES.map(t => (
          <button
            type="button" key={t}
            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
            onClick={()=>setText(prev => (prev ? prev + '\n' + t : t))}
          >
            ＋ {t}
          </button>
        ))}
      </div>

      <textarea
        className="mt-2 w-full border rounded px-3 py-2"
        rows={3}
        placeholder="自由メモ"
        value={text}
        onChange={e=>setText(e.target.value)}
      />
      <div className="mt-2 text-right">
        <button onClick={submit} className="rounded-xl px-4 py-2 bg-violet-600 text-white">
          追加
        </button>
      </div>
    </div>
  )
}
