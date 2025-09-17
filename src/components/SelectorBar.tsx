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
  onRenameConcert,
  onRenamePiece,
  onDeleteConcert,
  onDeletePiece,
  onReorderConcert,
  onReorderPiece,
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
  onRenameConcert: (id: string, title: string)=>void
  onRenamePiece: (id: string, title: string)=>void
  onDeleteConcert: (id: string)=>void
  onDeletePiece: (id: string)=>void
  onReorderConcert: (id: string, dir: 'up'|'down')=>void
  onReorderPiece: (id: string, dir: 'up'|'down')=>void
  canEdit: boolean
}) {
  const selectedConcert = concerts.find(c=>c.id===selectedConcertId) ?? concerts[0]
  const pieces = selectedConcert?.pieces ?? []

  const promptRenameConcert = () => {
    const cur = selectedConcert?.title ?? ''
    const title = window.prompt('演奏会名を編集', cur)?.trim()
    if (title) onRenameConcert(selectedConcertId, title)
  }
  const promptRenamePiece = () => {
    const cur = pieces.find(p=>p.id===selectedPieceId)?.title ?? ''
    const title = window.prompt('曲名を編集', cur)?.trim()
    if (title) onRenamePiece(selectedPieceId, title)
  }

  const idxConcert = Math.max(0, concerts.findIndex(c=>c.id===selectedConcertId))
  const idxPiece = Math.max(0, pieces.findIndex(p=>p.id===selectedPieceId))

  return (
    <div className="w-full sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto p-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
        {/* 演奏会 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
          <label className="text-sm text-gray-600 sm:w-auto">演奏会</label>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <select
              className="w-full sm:w-auto px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={selectedConcertId}
              onChange={e=>onChangeConcert(e.target.value)}
            >
              {concerts.map(c=>(
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            {canEdit && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={onAddConcert}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                >
                  ＋演奏会
                </button>

                {/* 並び替え（演奏会） */}
                <div className="flex gap-1">
                  <button
                    onClick={()=>onReorderConcert(selectedConcertId, 'up')}
                    disabled={idxConcert<=0}
                    className={`px-3 py-2 rounded-xl border ${idxConcert<=0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50'}`}
                    title="上へ"
                  >↑</button>
                  <button
                    onClick={()=>onReorderConcert(selectedConcertId, 'down')}
                    disabled={idxConcert>=concerts.length-1}
                    className={`px-3 py-2 rounded-xl border ${idxConcert>=concerts.length-1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50'}`}
                    title="下へ"
                  >↓</button>
                </div>

                <button
                  onClick={promptRenameConcert}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl border text-orange-700 border-orange-300 hover:bg-orange-50"
                >
                  編集…
                </button>
                <button
                  onClick={()=>{
                    if (window.confirm('この演奏会を削除しますか？')) {
                      onDeleteConcert(selectedConcertId)
                    }
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-red-400 text-red-600 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 曲 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
          <label className="text-sm text-gray-600 sm:w-auto">曲</label>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <select
              className="w-full sm:w-auto px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={selectedPieceId}
              onChange={e=>onChangePiece(e.target.value)}
            >
              {pieces.map(p=>(
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>

            {canEdit && (
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={onAddPiece}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                >
                  ＋曲
                </button>

                {/* 並び替え（曲） */}
                <div className="flex gap-1">
                  <button
                    onClick={()=>onReorderPiece(selectedPieceId, 'up')}
                    disabled={idxPiece<=0}
                    className={`px-3 py-2 rounded-xl border ${idxPiece<=0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50'}`}
                    title="上へ"
                  >↑</button>
                  <button
                    onClick={()=>onReorderPiece(selectedPieceId, 'down')}
                    disabled={idxPiece>=pieces.length-1}
                    className={`px-3 py-2 rounded-xl border ${idxPiece>=pieces.length-1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-orange-50'}`}
                    title="下へ"
                  >↓</button>
                </div>

                <button
                  onClick={promptRenamePiece}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl border text-orange-700 border-orange-300 hover:bg-orange-50"
                >
                  編集…
                </button>
                <button
                  onClick={()=>{
                    if (window.confirm('この曲を削除しますか？')) {
                      onDeletePiece(selectedPieceId)
                    }
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-red-400 text-red-600 hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            )}
          </div>
        </div>

        {/* パート */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
          <label className="text-sm text-gray-600 sm:w-auto">パート</label>
          <select
            className="w-full sm:w-auto px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={selectedPart}
            onChange={e=>onChangePart(e.target.value)}
          >
            {Array.from(ORCH_PARTS).map(name=>(
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
