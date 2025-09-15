import { useState } from 'react'

export type PieceComment = {
  id: string
  text: string
  authorName: string
  createdAt: string
}

export default function PieceComments({
  comments,
  canEdit,
  onAdd
}:{ comments: PieceComment[]; canEdit:boolean; onAdd:(text:string)=>void }) {
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }

  return (
    <section className="mt-8">
      <h3 className="font-semibold mb-2">曲コメント</h3>
      {canEdit && (
        <div className="mb-3">
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={2}
            placeholder="この曲全体の方針・注意をコメント"
            value={text}
            onChange={(e)=>setText(e.target.value)}
          />
          <div className="text-right mt-2">
            <button onClick={submit} className="px-4 py-2 rounded-xl bg-violet-600 text-white">投稿</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {comments.length===0 ? (
          <p className="text-gray-500 text-sm">まだコメントはありません。</p>
        ) : comments.map(c => (
          <article key={c.id} className="p-3 rounded-xl border bg-white">
            <div className="text-xs text-gray-500 mb-1">
              {new Date(c.createdAt).toLocaleString()} / {c.authorName}
            </div>
            <p className="whitespace-pre-wrap">{c.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
