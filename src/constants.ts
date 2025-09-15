export const ORCH_PARTS = [
  // Strings（Cbなし）
  'Vn1','Vn2','Va','Vc',
  // Woodwinds
  'Fl','Ob','Cl','Fg',
  // Brass
  'Hn','Tp','Tb','Tuba',
  // Percussion
  'Timp','Perc',
  // 追加
  'Drum','Bass'
] as const

export const DEFAULT_STATE = {
  concerts: [
    { id: 'c1', title: 'Default-Sample', pieces: [
      { id: 'p1', title: '曲A（サンプル）', notes: [] as any[] }
    ]}
  ]
}
