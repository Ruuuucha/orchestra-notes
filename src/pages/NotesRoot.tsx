// src/pages/NotesRoot.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SelectorBar from '../components/SelectorBar'
import NotesList from '../components/NotesList'
import {
  ORCH_PARTS,
  DEFAULT_STATE,
  type AppState,
  type Concert,
  type Piece,
  type Note
} from '../constants'
import '../App.css'

type Me = { userId: string; email: string; displayName: string }

const DEMO =
  !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY

const SET_SLUG = 'default-sample'
const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`

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
        const oldNotes: Note[] = (p.notes ?? []) as Note[]
        const mapped = Array.from(ORCH_PARTS, (name) => ({
          name,
          notes: oldNotes.filter((n: any) => (n?.part ? n.part === name : false))
        }))
        const rest = oldNotes.filter((n: any) => !n?.part)
        if (rest.length) {
          const vn1 = mapped.find((x) => x.name === 'Vn1')
          if (vn1) vn1.notes.push(...rest)
        }
        parts = mapped
      } else {
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

export default function NotesRoot() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [selectedConcertId, setSelectedConcertId] = useState<string>('c1')
  const [selectedPieceId, setSelectedPieceId] = useState<string>('p1')
  const [selectedPart, setSelectedPart] = useState<string>(ORCH_PARTS[0])

  const appMode = localStorage.getItem('appMode')

  useEffect(() => {
    ;(async () => {
      setLoading(true)

      if (DEMO) {
        const migrated = migrateShape(DEFAULT_STATE)
        setState(migrated)
        const c0 = migrated.concerts[0]
        setSelectedConcertId(c0.id)
        const p0 = c0.pieces[0]
        setSelectedPieceId(p0.id)
        setSelectedPart(ORCH_PARTS[0])
        setCanEdit(false)
        setLoading(false)
        return
      }

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

      const c0 = migrated.concerts[0]
      setSelectedConcertId(c0.id)
      const p0 = c0.pieces[0]
      setSelectedPieceId(p0.id)
      setSelectedPart(ORCH_PARTS[0])

      // 編集者モードの場合のみ権限チェック
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

  // ★ 追加：ノートを小節番号順にソート（measureFrom → measureTo → createdAt）
  const sortedNotes = useMemo(() => {
    const notes = currentPart?.notes ?? []
    return [...notes].sort((a, b) => {
      if (a.measureFrom !== b.measureFrom) return a.measureFrom - b.measureFrom
      if (a.measureTo !== b.measureTo) return a.measureTo - b.measureTo
      // 同じ小節範囲なら古い順（必要なら desc に変えてOK）
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }, [currentPart])

  const saveState = async (next: AppState) => {
    setState(next)
    if (DEMO) return
    const { error } = await supabase
      .from('sets')
      .update({ data: next })
      .eq('slug', SET_SLUG)
    if (error) {
      console.error('[save sets] error:', error)
      alert('保存に失敗しました: ' + error.message)
    }
  }

  const addNote = async (
    partial: Omit<Note, 'id' | 'createdAt' | 'authorName' | 'authorEmail'>
  ) => {
    if (!canEdit || !me || DEMO) return
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

  const deleteNote = async (noteId: string) => {
    if (!canEdit || DEMO) return
    const next = structuredClone(state)
    const part = next.concerts
      .find((c) => c.id === currentConcert.id)!
      .pieces.find((p) => p.id === currentPiece.id)!
      .parts.find((pt) => pt.name === selectedPart)!
    part.notes = part.notes.filter((n) => n.id !== noteId)
    await saveState(next)
  }

  const addConcert = async () => {
    if (!canEdit || DEMO) return
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

  const addPiece = async () => {
    if (!canEdit || DEMO) return
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

  const renameConcert = async (concertId: string, title: string) => {
    if (!canEdit || DEMO) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === concertId)
    if (!c) return
    c.title = title
    await saveState(next)
  }

  const renamePiece = async (pieceId: string, title: string) => {
    if (!canEdit || DEMO) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === currentConcert.id)
    if (!c) return
    const p = c.pieces.find((p) => p.id === pieceId)
    if (!p) return
    p.title = title
    await saveState(next)
  }

  const deleteConcert = async (concertId: string) => {
    if (!canEdit || DEMO) return
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

  const deletePiece = async (pieceId: string) => {
    if (!canEdit || DEMO) return
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

  const reorderConcert = async (concertId: string, dir: 'up' | 'down') => {
    if (!canEdit || DEMO) return
    const next = structuredClone(state)
    const idx = next.concerts.findIndex((c) => c.id === concertId)
    if (idx === -1) return
    const to = dir === 'up' ? idx - 1 : idx + 1
    if (to < 0 || to >= next.concerts.length) return
    const [moved] = next.concerts.splice(idx, 1)
    next.concerts.splice(to, 0, moved)
    await saveState(next)
  }

  const reorderPiece = async (pieceId: string, dir: 'up' | 'down') => {
    if (!canEdit || DEMO) return
    const next = structuredClone(state)
    const c = next.concerts.find((c) => c.id === currentConcert.id)
    if (!c) return
    const idx = c.pieces.findIndex((p) => p.id === pieceId)
    if (idx === -1) return
    const to = dir === 'up' ? idx - 1 : idx + 1
    if (to < 0 || to >= c.pieces.length) return
    const [moved] = c.pieces.splice(idx, 1)
    c.pieces.splice(to, 0, moved)
    await saveState(next)
  }

  const rightLabel = DEMO
    ? 'Demo（閲覧専用）'
    : appMode === 'editor'
    ? canEdit
      ? `${me?.displayName || 'Editor'}（編集可）`
      : `${me?.displayName || 'Editor'}（閲覧専用）`
    : '閲覧モード'

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
        onAddConcert={() => {
          addConcert()
        }}
        onAddPiece={() => {
          addPiece()
        }}
        onRenameConcert={(id, title) => {
          renameConcert(id, title)
        }}
        onRenamePiece={(id, title) => {
          renamePiece(id, title)
        }}
        onDeleteConcert={(id) => {
          deleteConcert(id)
        }}
        onDeletePiece={(id) => {
          deletePiece(id)
        }}
        onReorderConcert={(id, dir) => {
          reorderConcert(id, dir)
        }}
        onReorderPiece={(id, dir) => {
          reorderPiece(id, dir)
        }}
        canEdit={canEdit}
      />
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-orange-700">
              {currentConcert.title} / {currentPiece.title}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600">Orchestra Notes</p>
              <Link to="/app" className="text-xs underline text-gray-500">
                ← Appへ
              </Link>
            </div>
          </div>
          <div className="text-sm text-gray-700">{rightLabel}</div>
        </div>

        {loading ? (
          <p>読み込み中…</p>
        ) : (
          <>
            <NotesList
              notes={sortedNotes}
              canEdit={canEdit}
              onAdd={(partial) => {
                addNote(partial)
              }}
              onDelete={(noteId) => {
                deleteNote(noteId)
              }}
            />
            {!canEdit && (
              <p className="mt-4 text-xs text-gray-500">
                ※ このアプリは閲覧専用です。編集が必要な場合は管理者にお問い合わせください。
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
