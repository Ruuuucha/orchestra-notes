import { useState } from 'react'
import type { Note } from '../constants'

export default function NotesList({
  notes,
  canEdit,
  onAdd,
  onDelete
}:{
  notes: Note[]
  canEdit: boolean
  onAdd: (n: Omit<Note,'id'|'createdAt'|'authorName'|'authorEmail'>)=>void
  onDelete: (noteId: string)=>void   // 追加: コメント削除
}) {
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(1)
  const [text, setText] = useState('')

  const add = () => {
    const f = Number(from)||1
    const t = Number(to)||f
    const content = text.trim()
    if (!content) return
    onAdd({ measureFrom: f, measureTo: t, text: content })
    setText('')
  }

  return (
    <section className="mt-4">
      {canEdit && (
        <div className="p-4 rounded-2xl border bg-orange-50 border-orange-200">
          <h3 className="font-semibold text-orange-800 mb-2">注意を追加</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-700">小節</label>
            <input type="number" min={1} value={from}
              onChange={e=>setFrom(parseInt(e.target.value||'1'))}
              className="w-24 px-2 py-1 rounded border" />
            <span>–</span>
            <input type="number" min={1} value={to}
              onChange={e=>setTo(parseInt(e.target.value||String(from)))} 
              className="w-24 px-2 py-1 rounded border" />
          </div>
          <textarea
            rows={3}
            className="mt-2 w-full px-3 py-2 rounded border"
            placeholder="どのような注意が必要かを記載"
            value={text}
            onChange={e=>setText(e.target.value)}
          />
          <div className="mt-2 text-right">
            <button
              onClick={add}
              className="px-4 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
            >
              追加
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {notes.length===0 ? (
          <p className="text-gray-500">このパートの注意はまだありません。</p>
        ) : notes.map(n=>(
          <article key={n.id} className="p-3 rounded-2xl border bg-white">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-orange-700">
                {n.measureFrom}–{n.measureTo} 小節
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500">
                  {n.authorName ?? '—'} / {new Date(n.createdAt).toLocaleString()}
                </div>
                {canEdit && (
                  <button
                    onClick={()=>{
                      if (window.confirm('このコメントを削除しますか？')) onDelete(n.id)
                    }}
                    className="px-2 py-1 text-xs rounded border border-red-400 text-red-600 hover:bg-red-50"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
            <p className="whitespace-pre-wrap">{n.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
