import { useState } from 'react'
import { CATEGORY_PRESETS } from '../constants'

export default function CategoryPicker({
  value,
  onChange
}:{ value: string[]; onChange:(v:string[])=>void }) {
  const [input, setInput] = useState('')

  const toggle = (cat:string) => {
    if (value.includes(cat)) onChange(value.filter(v => v !== cat))
    else onChange([...value, cat])
  }

  const add = () => {
    const v = input.trim()
    if (!v) return
    if (!value.includes(v)) onChange([...value, v])
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {CATEGORY_PRESETS.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={()=>toggle(cat)}
            className={`px-2 py-1 rounded-full border text-sm ${
              value.includes(cat) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          placeholder="自由カテゴリを追加"
          value={input}
          onChange={(e)=>setInput(e.target.value)}
        />
        <button onClick={add} type="button" className="px-3 py-1 rounded border">追加</button>
      </div>
      {value.length > 0 && (
        <div className="text-xs text-gray-600">
          選択中：{value.join(' / ')}
        </div>
      )}
    </div>
  )
}
