import { ORCH_PARTS, type Concert } from '../constants'

export default function SelectorBar({
  concerts,
  selectedConcertId,
  selectedPieceId,
  selectedPart,
  onChangeConcert,
  onChangePiece,
  onChangePart,
  onAddConcert,
  onAddPiece,
  onDeleteConcert,
  onDeletePiece,
  canEdit
}:{
  concerts: Concert[]
  selectedConcertId: string
  selectedPieceId: string
  selectedPart: string
  onChangeConcert: (id: string)=>void
  onChangePiece: (id: string)=>void
  onChangePart: (name: string)=>void
  onAddConcert: ()=>void
  onAddPiece: ()=>void
  onDeleteConcert: (id: string)=>void   // 追加: 演奏会削除
  onDeletePiece: (id: string)=>void     // 追加: 曲削除
  canEdit: boolean
}) {
  const selectedConcert = concerts.find(c=>c.id===selectedConcertId) ?? concerts[0]
  const pieces = selectedConcert?.pieces ?? []

  return (
    <div className="w-full sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto p-3 flex flex-wrap items-center gap-2">
        {/* 演奏会 */}
        <label className="text-sm text-gray-600">演奏会</label>
        <select
          className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400"
          value={selectedConcertId}
          onChange={e=>onChangeConcert(e.target.value)}
        >
          {concerts.map(c=>(
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        {canEdit && (
          <>
            <button
              onClick={onAddConcert}
              className="px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
            >
              ＋演奏会
            </button>
            <button
              onClick={()=>{
                if (window.confirm('この演奏会を削除しますか？')) {
                  onDeleteConcert(selectedConcertId)
                }
              }}
              className="px-3 py-2 rounded-xl border border-red-400 text-red-600 hover:bg-red-50"
            >
              演奏会削除
            </button>
          </>
        )}

        {/* 曲 */}
        <label className="ml-3 text-sm text-gray-600">曲</label>
        <select
          className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400"
          value={selectedPieceId}
          onChange={e=>onChangePiece(e.target.value)}
        >
          {pieces.map(p=>(
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {canEdit && (
          <>
            <button
              onClick={onAddPiece}
              className="px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
            >
              ＋曲
            </button>
            <button
              onClick={()=>{
                if (window.confirm('この曲を削除しますか？')) {
                  onDeletePiece(selectedPieceId)
                }
              }}
              className="px-3 py-2 rounded-xl border border-red-400 text-red-600 hover:bg-red-50"
            >
              曲削除
            </button>
          </>
        )}

        {/* パート */}
        <label className="ml-3 text-sm text-gray-600">パート</label>
        <select
          className="px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400"
          value={selectedPart}
          onChange={e=>onChangePart(e.target.value)}
        >
          {Array.from(ORCH_PARTS).map(name=>(
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
