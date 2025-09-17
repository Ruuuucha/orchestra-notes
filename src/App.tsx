import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Landing from './components/Landing'
import EditorGate from './components/EditorGate'
import Login from './components/Login'
import ProfileGate from './components/ProfileGate'
import SelectorBar from './components/SelectorBar'
import NotesList from './components/NotesList'
import {
  ORCH_PARTS,
  DEFAULT_STATE,
  type AppState,
  type Concert,
  type Piece,
  type Note
} from './constants'
import './App.css'

type Me = { userId: string; email: string; displayName: string }

const SET_SLUG = 'default-sample'
const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`

// 旧データ（piece.notes）→ 新データ（piece.parts[].notes）へマイグレーション
function migrateShape(raw: any): AppState {
  const base: AppState | any = raw?.concerts ? raw : DEFAULT_STATE
  const next: AppState = { concerts: [] }

  for (const c of base.concerts ?? []) {
    const nc: Concert = {
      id: c.id ?? newId('c'),
      title: c.title ?? 'Concert',
      pieces: []
    }

    for (const pAny of c.pieces ?? []) {
      const p = pAny as any

      let parts = p.parts as any[] | undefined
      if (!parts) {
        // 旧形式: piece.notes に入っていたものをパートへ仕分け
        const oldNotes: Note[] = (p.notes ?? []) as Note[]
        const mapped = Array.from(ORCH_PARTS, (name) => ({
          name,
          notes: oldNotes.filter((n: any) => (n?.part ? n.part === name : false))
        }))
        // part 無しの旧ノートは Vn1 に寄せる
        const rest = oldNotes.filter((n: any) => !n?.part)
        if (rest.length) {
          const vn1 = mapped.find((x) => x.name === 'Vn1')
          if (vn1) vn1.notes.push(...rest)
        }
        parts = mapped
      } else {
        // parts がある場合は ORCH_PARTS を満たすように足りないパートを補完
        const names = new Set(parts.map((x: any) => x.name))
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
        title: '新しい曲',
        parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
      })
    }
    next.concerts.push(nc)
  }

  if (next.concerts.length === 0) next.concerts = DEFAULT_STATE.concerts
  return next
}

export default function App() {
  // 入口モード
  const [entered, setEntered] = useState(false)
  const [mode, setMode] = useState<'guest' | 'editor' | null>(null)
  const [guestName, setGuestName] = useState<string | null>(null)

  // 認証・プロフィール
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

  // 環境変数の簡易ガード（本番で白画面回避）
  const envMissing =
    !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY
  if (envMissing) {
    return (
      <div style={{ padding: 16 }}>
        <h3>設定エラー</h3>
        <p>Supabase の環境変数が未設定です。管理者へ連絡してください。</p>
      </div>
    )
  }

  // セッション監視（ゲスト時は不要）
  useEffect(() => {
    if (guestName) return
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setSession(!!sess)
    )
    return () => sub.subscription.unsubscribe()
  }, [guestName])

  // データ読み込み & 権限判定
  useEffect(() => {
    ;(async () => {
      setLoading(true)

      // sets 取得（ゲストでも読み取りOK）
      const { data: s, error } = await supabase
        .from('sets')
        .select('data')
        .eq('slug', SET_SLUG)
        .maybeSingle()

      if (error) {
        console.error('[load sets] error:', error)
      }

      const migrated = migrateShape(s?.data ?? DEFAULT_STATE)
      setState(migrated)

      // 初期選択の整合
      const c0 = migrated.concerts[0]
      setSelectedConcertId(c0.id)
      const p0 = c0.pieces[0]
      setSelectedPieceId(p0.id)
      setSelectedPart(ORCH_PARTS[0])

      // 編集権限（ログイン時のみ）
      if (me) {
        const { data: editors } = await supabase
          .from('allowed_editors')
          .select('email')
          .eq('set_slug', SET_SLUG)

        setCanEdit(!!editors?.some((e) => e.email === me.email))
      } else {
        setCanEdit(false)
      }

      setLoading(false)
    })()
  }, [me, guestName])

  const currentConcert = useMemo(
    () => state.concerts.find((c) => c.id === selectedConcertId) ?? state.concerts[0],
    [state, selectedConcertId]
  )
  const currentPiece = useMemo(
    () =>
      currentConcert.pieces.find((p) => p.id === selectedPieceId) ??
      currentConcert.pieces[0],
    [currentConcert, selectedPieceId]
  )
  const currentPart = useMemo(
    () => currentPiece.parts.find((pt) => pt.name === selectedPart) ?? currentPiece.parts[0],
    [currentPiece, selectedPart]
  )

  const saveState = async (next: AppState) => {
    setState(next)
    const { error } = await supabase
      .from('sets')
      .update({ data: next })
      .eq('slug', SET_SLUG)
    if (error) {
      console.error('[save sets] error:', error)
      alert('保存に失敗しました: ' + error.message)
    }
  }

  // ====== 追加/編集/削除/並び替え ロジック ======

  // ノート追加（選択パート）
  const addNote = async (
    partial: Omit<Note, 'id' | 'createdAt' | 'authorName' | 'authorEmail'>
  ) => {
    if (!canEdit || !me) return
    const n: Note = {
      ...partial,
      id: crypto.randomUUID(),
      authorName: me.displayName,
      authorEmail: me.email,
      createdAt: new Date().toISOString()
    }
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === currentConcert.id)!
    const p = c.pieces.find((p) => p.id === currentPiece.id)!
    const pt = p.parts.find((pt) => pt.name === selectedPart)!
    pt.notes.push(n)
    await saveState(next)
  }

  // ノート削除
  const deleteNote = async (noteId: string) => {
    if (!canEdit) return
    const next = structuredClone(state)
    const part = next.concerts
      .find((c) => c.id === currentConcert.id)!
      .pieces.find((p) => p.id === currentPiece.id)!
      .parts.find((pt) => pt.name === selectedPart)!
    part.notes = part.notes.filter((n) => n.id !== noteId)
    await saveState(next)
  }

  // 演奏会追加
  const addConcert = async () => {
    if (!canEdit) return
    const title = window.prompt('演奏会名を入力')?.trim()
    if (!title) return
    const cId = newId('c')
    const next = structuredClone(state)
    next.concerts.push({
      id: cId,
      title,
      pieces: [
        {
          id: newId('p'),
          title: '新しい曲',
          parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
        }
      ]
    })
    await saveState(next)
    setSelectedConcertId(cId)
    setSelectedPieceId(next.concerts.find((c) => c.id === cId)!.pieces[0].id)
    setSelectedPart(ORCH_PARTS[0])
  }

  // 曲追加（選択演奏会）
  const addPiece = async () => {
    if (!canEdit) return
    const title = window.prompt('曲名を入力')?.trim()
    if (!title) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === currentConcert.id)!
    const pId = newId('p')
    c.pieces.push({
      id: pId,
      title,
      parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
    })
    await saveState(next)
    setSelectedPieceId(pId)
    setSelectedPart(ORCH_PARTS[0])
  }

  // 演奏会名変更
  const renameConcert = async (concertId: string, title: string) => {
    if (!canEdit) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === concertId)
    if (!c) return
    c.title = title
    await saveState(next)
  }

  // 曲名変更
  const renamePiece = async (pieceId: string, title: string) => {
    if (!canEdit) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === currentConcert.id)
    if (!c) return
    const p = c.pieces.find((p) => p.id === pieceId)
    if (!p) return
    p.title = title
    await saveState(next)
  }

  // 演奏会削除（0件保護つき）
  const deleteConcert = async (concertId: string) => {
    if (!canEdit) return
    const next = structuredClone(state)
    next.concerts = next.concerts.filter((c) => c.id !== concertId)

    if (next.concerts.length === 0) {
      next.concerts.push({
        id: newId('c'),
        title: '新しい演奏会',
        pieces: [
          {
            id: newId('p'),
            title: '新しい曲',
            parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
          }
        ]
      })
    }
    await saveState(next)

    const c0 = next.concerts[0]
    setSelectedConcertId(c0.id)
    setSelectedPieceId(c0.pieces[0].id)
    setSelectedPart(ORCH_PARTS[0])
  }

  // 曲削除（0件保護つき）
  const deletePiece = async (pieceId: string) => {
    if (!canEdit) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === currentConcert.id)
    if (!c) return
    c.pieces = c.pieces.filter((p) => p.id !== pieceId)

    if (c.pieces.length === 0) {
      c.pieces.push({
        id: newId('p'),
        title: '新しい曲',
        parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
      })
    }
    await saveState(next)

    setSelectedPieceId(c.pieces[0].id)
    setSelectedPart(ORCH_PARTS[0])
  }

  // 並び替え：演奏会
  const reorderConcert = async (concertId: string, dir: 'up'|'down') => {
    if (!canEdit) return
    const next = structuredClone(state)
    const idx = next.concerts.findIndex(c=>c.id===concertId)
    if (idx === -1) return
    const to = dir === 'up' ? idx - 1 : idx + 1
    if (to < 0 || to >= next.concerts.length) return
    const [moved] = next.concerts.splice(idx, 1)
    next.concerts.splice(to, 0, moved)
    await saveState(next)
  }

  // 並び替え：曲（選択演奏会内）
  const reorderPiece = async (pieceId: string, dir: 'up'|'down') => {
    if (!canEdit) return
    const next = structuredClone(state)
    const c = next.concerts.find(c=>c.id===currentConcert.id)
    if (!c) return
    const idx = c.pieces.findIndex(p=>p.id===pieceId)
    if (idx === -1) return
    const to = dir === 'up' ? idx - 1 : idx + 1
    if (to < 0 || to >= c.pieces.length) return
    const [moved] = c.pieces.splice(idx, 1)
    c.pieces.splice(to, 0, moved)
    await saveState(next)
  }

  // ================= 画面分岐 =================

  // 入口（まだ選択していない）
  if (!entered) {
    return (
      <Landing
        onEditor={() => {
          setMode('editor')
          setEntered(true)
        }}
        onGuest={(n) => {
          setMode('guest')
          setGuestName(n)
          setEntered(true)
        }}
      />
    )
  }

  // 編集者ルート：セッション状態で明確に切替
  if (mode === 'editor') {
    if (session === null) {
      // セッション確認中（Magic Link 直後など）
      return <div className="min-h-screen grid place-items-center">ログイン確認中…</div>
    }
    if (session === false) {
      // 未ログイン → Login（メールリンク）
      return <Login />
    }
    // session === true
    if (!me) {
      // プロフィール（表示名）の初回登録
      return (
        <ProfileGate
          onReady={(p) => {
            localStorage.setItem('displayName', p.displayName)
            setMe(p)
          }}
        />
      )
    }
  }

  // ゲスト閲覧
  if (mode === 'guest') {
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
          onAddConcert={() => {}}
          onAddPiece={() => {}}
          onRenameConcert={() => {}}
          onRenamePiece={() => {}}
          onDeleteConcert={() => {}}
          onDeletePiece={() => {}}
          onReorderConcert={() => {}}
          onReorderPiece={() => {}}
          canEdit={false}
        />
        <div className="max-w-5xl mx-auto p-4">
          <Header
            title={`${currentConcert.title} / ${currentPiece.title}`}
            right={`${guestName ?? 'Guest'}（閲覧専用）`}
          />
          {loading ? (
            <p>読み込み中…</p>
          ) : (
            <NotesList
              notes={currentPart.notes}
              canEdit={false}
              onAdd={() => {}}
              onDelete={() => {}}
            />
          )}
        </div>
      </div>
    )
  }

  // ここから先は編集者ログイン済みの画面
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
        onRenameConcert={renameConcert}
        onRenamePiece={renamePiece}
        onDeleteConcert={deleteConcert}
        onDeletePiece={deletePiece}
        onReorderConcert={reorderConcert}
        onReorderPiece={reorderPiece}
        canEdit={canEdit}
      />
      <div className="max-w-5xl mx-auto p-4">
        <Header
          title={`${currentConcert.title} / ${currentPiece.title}`}
          right={`${me!.displayName}（${canEdit ? '編集可' : '閲覧専用'}）`}
        />
        {loading ? (
          <p>読み込み中…</p>
        ) : (
          <NotesList
            notes={currentPart.notes}
            canEdit={canEdit}
            onAdd={addNote}
            onDelete={deleteNote}
          />
        )}
      </div>
    </div>
  )
}

function Header({ title, right }: { title: string; right: string }) {
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
