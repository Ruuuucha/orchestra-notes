import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import ProfileGate from './components/ProfileGate'
import Landing from './components/Landing'
import InviteEditor from './components/InviteEditor'
import { ORCH_PARTS, DEFAULT_STATE } from './constants'
import './App.css'

// ===== Types =====
type Note = {
  id: string
  part: string
  measureFrom: number
  measureTo: number
  text: string
  authorName?: string      // UI表示はこれのみ
  authorEmail?: string     // 権限判定用（UIでは出さない）
  createdAt: string
}
type Piece = { id:string; title:string; notes: Note[] }
type Concert = { id:string; title:string; pieces: Piece[] }
type AppState = { concerts: Concert[] }
type Me = { userId: string; email: string; displayName: string }

// ===== App =====
export default function App() {
  const [entered, setEntered] = useState(false) // ランディング→本体へ
  const [session, setSession] = useState<boolean | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // セッション監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setSession(!!sess)
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  // プロフィール確定後にデータ読み込み
  useEffect(() => {
    (async () => {
      if (!me) { setLoading(false); return }
      setLoading(true)
      // default-sample を取得
      const { data: s, error } = await supabase
        .from('sets')
        .select('data, owner_email')
        .eq('slug','default-sample')
        .maybeSingle()
      if (error) console.error(error)
      if (s?.data) {
        setState(s.data as AppState)
      } else {
        // 存在しなければ作成（RLSによりオーナーのみ可）
        const { error: insErr } = await supabase.from('sets').insert({
          slug:'default-sample',
          title:'Default-Sample',
          data: DEFAULT_STATE,
          owner_email: me.email
        })
        if (insErr) console.warn(insErr.message)
        setState(DEFAULT_STATE)
      }
      // 許可確認
      const { data: editors } = await supabase
        .from('allowed_editors')
        .select('email')
        .eq('set_slug','default-sample')
      setCanEdit(!!editors?.some(e => e.email === me.email))
      setLoading(false)
    })()
  }, [me])

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
  if (!entered) return <Landing onEnter={() => setEntered(true)} />
  if (session === null) return null
  if (!session) return <Login />
  if (session && !me) return <ProfileGate onReady={setMe} />

  // ===== 本体UI =====
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Default-Sample</h1>
          <p className="text-sm text-gray-500">Orchestra Notes</p>
        </div>
        <div className="text-sm text-gray-600">
          {me?.displayName}（{canEdit ? '編集可' : '閲覧専用'}）
        </div>
      </header>

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          {/* 編集者追加（既存編集者/オーナーのみ可） */}
          {canEdit && (
            <div className="mb-4">
              <InviteEditor setSlug="default-sample" />
            </div>
          )}

          {/* 追加フォーム（編集可のみ表示） */}
          {canEdit && <AddNoteForm onAdd={addNote} />}

          {/* ノート一覧 */}
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
        </>
      )}
    </div>
  )
}

// ===== 内部フォームコンポーネント =====
function AddNoteForm({
  onAdd
}:{
  onAdd: (p: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>) => void
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
          placeholder="from"
        />
        <span>–</span>
        <input
          type="number" min={1}
          className="w-24 border rounded px-2 py-1"
          value={to}
          onChange={e=>setTo(parseInt(e.target.value || '1'))}
          placeholder="to"
        />
      </div>

      <textarea
        className="mt-2 w-full border rounded px-3 py-2"
        rows={3}
        placeholder="自由メモ（表情/出だし/終わり/バランス/リズムは廃止）"
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
