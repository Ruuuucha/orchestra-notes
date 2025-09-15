// src/constants.ts
export const ORCH_PARTS = [
  // Strings（Cbなし）
  'Vn1','Vn2','Va','Vc',
  // Woodwinds
  'Fl','Ob','Cl','Fg',
  // Brass
  'Hr','Tp','Tb','Tuba',
  // Percussion
  'Timp','Perc',
  // 追加
  'Drum','Bass'
] as const

export type Note = {
  id: string
  measureFrom: number
  measureTo: number
  text: string
  authorName?: string
  authorEmail?: string
  createdAt: string
}

export type PartNotes = {
  name: string
  notes: Note[]
}

export type Piece = {
  id: string
  title: string
  parts: PartNotes[]
}

export type Concert = {
  id: string
  title: string
  pieces: Piece[]
}

export type AppState = {
  concerts: Concert[]
}

// デフォルトは全パートを空で用意
export const DEFAULT_STATE: AppState = {
  concerts: [
    {
      id: 'c1',
      title: 'Default-Sample',
      pieces: [
        {
          id: 'p1',
          title: '曲A（サンプル）',
          parts: Array.from(ORCH_PARTS, (name) => ({ name, notes: [] }))
        }
      ]
    }
  ]
}
