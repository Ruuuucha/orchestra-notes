type Piece = { id:string; title:string }
type Concert = { id:string; title:string; pieces: Piece[] }

export default function Sidebar({
  concerts,
  selectedConcertId,
  selectedPieceId,
  onSelect
}:{
  concerts: Concert[]
  selectedConcertId: string
  selectedPieceId: string
  onSelect: (cId:string, pId:string)=>void
}) {
  return (
    <aside className="w-64 shrink-0 border-r bg-white">
      <div className="p-4 font-bold">演奏会</div>
      <ul className="space-y-1 px-2">
        {concerts.map(c => (
          <li key={c.id} className="mb-2">
            <div className={`px-2 py-1 text-sm ${c.id===selectedConcertId?'font-semibold':''}`}>
              {c.title}
            </div>
            <ul className="pl-3">
              {c.pieces.map(p => (
                <li key={p.id}>
                  <button
                    className={`w-full text-left px-2 py-1 rounded hover:bg-gray-100 ${
                      c.id===selectedConcertId && p.id===selectedPieceId ? 'bg-gray-100 font-medium' : ''
                    }`}
                    onClick={()=>onSelect(c.id, p.id)}
                  >
                    ・{p.title}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  )
}
