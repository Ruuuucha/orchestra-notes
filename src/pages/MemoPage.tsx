// src/pages/MemoPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEFAULT_STATE, type AppState, type Concert, type Piece, ORCH_PARTS } from '../constants'

type Me = { userId: string; email: string; displayName: string }

type Memo = {
  id: string
  body: string
  createdAt: string
  authorName?: string
  authorEmail?: string
}

const DEMO =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

const SET_SLUG = 'default-sample'
const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`

// 既存データに memos を補完（Notes の演奏会/曲構造をそのまま使う）
function migrateWithMemos(raw: any): AppState {
  const base: any = raw?.concerts ? raw : DEFAULT_STATE
  const next: any = structuredClone(base)

  for (const c of next.concerts ?? []) {
    for (const p of c.pieces ?? []) {
      if (!p.memos) p.memos = []
      // parts がない旧データ対策（念のため：NotesRoot の migrate と同系）
      if (!p.parts) {
        p.parts = Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
      }
    }
  }
  if (!next.concerts?.length) return DEFAULT_STATE
  return next as AppState
}

export default function MemoPage() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [me, setMe] = useState<Me | null>(null)

  const [selectedConcertId, setSelectedConcertId] = useState<string>('c1')
  const [selectedPieceId, setSelectedPieceId] = useState<string>('p1')

  const [body, setBody] = useState('')

  const appMode = localStorage.getItem('appMode')

  useEffect(() => {
    ;(async () => {
      setLoading(true)

      if (DEMO) {
        const migrated = migrateWithMemos(DEFAULT_STATE)
        setState(migrated)
        const c0 = migrated.concerts[0]
        setSelectedConcertId(c0.id)
        setSelectedPieceId(c0.pieces[0].id)
        setCanEdit(false)
        setLoading(false)
        return
      }

      const { data: s, error } = await supabase
        .from('sets')
        .select('data')
        .eq('slug', SET_SLUG)
        .maybeSingle()

      if (error) console.error('[load sets] error:', error)

      const migrated = migrateWithMemos(s?.data ?? DEFAULT_STATE)
      setState(migrated)

      const c0 = migrated.concerts[0]
      setSelectedConcertId(c0.id)
      setSelectedPieceId(c0.pieces[0].id)

      // editor のときだけ権限チェック（NotesRoot と同じ考え方）
      if (appMode === 'editor') {
        const { data: sess } = await supabase.auth.getSession()
        const email = sess?.session?.user?.email
        const displayName = localStorage.getItem('displayName') || 'User'
        if (email) {
          setMe({ userId: sess.session!.user.id, email, displayName })
          const { data: editors } = await supabase
            .from('allowed_editors')
            .select('email')
            .eq('set_slug', SET_SLUG)
          setCanEdit(!!editors?.some((e) => e.email === email))
        }
      } else {
        setCanEdit(false)
      }

      setLoading(false)
    })()
  }, [appMode])

  const currentConcert: Concert = useMemo(
    () => state.concerts.find((c) => c.id === selectedConcertId) ?? state.concerts[0],
    [state, selectedConcertId]
  )
  const currentPiece: any = useMemo(
    () => currentConcert.pieces.find((p) => p.id === selectedPieceId) ?? currentConcert.pieces[0],
    [currentConcert, selectedPieceId]
  )

  const memos: Memo[] = (currentPiece?.memos ?? []) as Memo[]

  // 時系列順（新しい順を上に）
  const sortedMemos = useMemo(() => {
    return [...memos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [memos])

  const saveState = async (next: AppState) => {
    setState(next)
    if (DEMO) return
    const { error } = await supabase.from('sets').update({ data: next }).eq('slug', SET_SLUG)
    if (error) {
      console.error('[save sets] error:', error)
      alert('保存に失敗しました: ' + error.message)
    }
  }

  const addMemo = async () => {
    const text = body.trim()
    if (!text) return
    if (!canEdit || DEMO) return

    const next = structuredClone(state) as any
    const c = next.concerts.find((c: any) => c.id === currentConcert.id)!
    const p = c.pieces.find((p: any) => p.id === currentPiece.id)!
    if (!p.memos) p.memos = []

    const memo: Memo = {
      id: crypto.randomUUID(),
      body: text,
      createdAt: new Date().toISOString(),
      authorName: me?.displayName,
      authorEmail: me?.email,
    }
    p.memos.push(memo)

    await saveState(next)
    setBody('')
  }

  const deleteMemo = async (memoId: string) => {
    if (!canEdit || DEMO) return
    const next = structuredClone(state) as any
    const c = next.concerts.find((c: any) => c.id === currentConcert.id)!
    const p = c.pieces.find((p: any) => p.id === currentPiece.id)!
    p.memos = (p.memos ?? []).filter((m: Memo) => m.id !== memoId)
    await saveState(next)
  }

  if (loading) return <div className="p-4">読み込み中…</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-orange-700">変更点メモ</h1>
            <div className="text-sm text-gray-600">
              <Link className="underline" to="/app">← AppHubへ</Link>
            </div>
          </div>
          <div className="text-sm text-gray-700">
            {canEdit ? '編集可' : '閲覧のみ'}
          </div>
        </div>

        {/* 演奏会選択 */}
        <div className="bg-white border rounded-2xl p-3 mb-3">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm">
              <div className="text-gray-600 mb-1">演奏会</div>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={selectedConcertId}
                onChange={(e) => {
                  const id = e.target.value
                  setSelectedConcertId(id)
                  const c = state.concerts.find((x) => x.id === id) ?? state.concerts[0]
                  setSelectedPieceId(c.pieces[0].id)
                }}
              >
                {state.concerts.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <div className="text-gray-600 mb-1">曲</div>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={selectedPieceId}
                onChange={(e) => setSelectedPieceId(e.target.value)}
              >
                {currentConcert.pieces.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* 編集欄 */}
        {canEdit && (
          <div className="bg-white border rounded-2xl p-3 mb-4">
            <div className="text-sm text-gray-600 mb-2">
              何が変わったか（例：A公演 / 1曲目 / Vn1 ボーイング 12小節〜変更）
            </div>
            <textarea
              className="w-full border rounded-xl px-3 py-2"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="変更内容を記録…"
            />
            <button
              className="mt-2 rounded-2xl px-4 py-2 bg-orange-500 text-white hover:bg-orange-600"
              onClick={addMemo}
            >
              メモを追加
            </button>
          </div>
        )}

        {/* 一覧（時系列） */}
        <div className="space-y-3">
          {sortedMemos.length === 0 ? (
            <div className="text-gray-500 text-sm">メモはまだありません。</div>
          ) : (
            sortedMemos.map((m) => (
              <div key={m.id} className="bg-white border rounded-2xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    {new Date(m.createdAt).toLocaleString()}
                    {m.authorName ? ` · ${m.authorName}` : ''}
                  </div>
                  {canEdit && (
                    <button
                      className="text-xs underline text-gray-500"
                      onClick={() => deleteMemo(m.id)}
                    >
                      削除
                    </button>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-wrap">{m.body}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
