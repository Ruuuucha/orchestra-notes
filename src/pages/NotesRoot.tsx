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
  const [me, setMe] = useState<{ userId: string; email: string; displayName: string } | null>(null)
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

      setLoading(false)
    })()
  }, [])

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

  const rightLabel = DEMO
    ? 'Demo（閲覧専用）'
    : appMode === 'editor'
    ? '編集者モード（閲覧専用）'
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
              notes={currentPart.notes}
              canEdit={false}
              onAdd={() => {}}
              onDelete={() => {}}
            />
            <p className="mt-4 text-xs text-gray-500">
              ※ このアプリは閲覧専用です。編集が必要な場合は管理者にお問い合わせください。
            </p>
          </>
        )}
      </div>
    </div>
  )
}