export default function Landing({ onEnter }:{ onEnter: ()=>void }) {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Orchestra Notes</h1>
        <button
          onClick={onEnter}
          className="rounded-2xl px-6 py-3 bg-violet-600 text-white shadow hover:opacity-90"
        >
          Enter Orchestra Notes
        </button>
      </div>
    </div>
  )
}
