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

// よく使うカテゴリ（自由追加もOK）
export const CATEGORY_PRESETS = [
  '音程', 'アーティキュレーション', 'ダイナミクス',
  '同小節要注意', 'シンコペ', 'ハーモニー',
  'ブレス', '受け渡し', '入るタイミング'
] as const

// 参考：テンプレ一発入力（自由メモに貼る用）
export const NOTE_TEMPLATES = [
  '入り注意（誰の後／指揮キュー）',
  'シンコペ注意（縦を合わせる）',
  '音程注意（長3rd / 和声チェック）',
  '受け渡し（→Cl／←Ob など）',
  'ダイナミクス：mp 固定／pp から段階的に'
]

export const DEFAULT_STATE = {
  concerts: [
    {
      id: 'c1', title: 'Default-Sample',
      pieces: [
        { id: 'p1', title: '曲A（サンプル）', notes: [], comments: [] }
      ]
    }
  ]
}
