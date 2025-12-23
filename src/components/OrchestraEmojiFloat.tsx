import { useEffect, useMemo, useState } from 'react'

type Props = {
  /** 表示時間（ms）: 例 2500 */
  durationMs?: number
  /** 同時に出す絵文字の数 */
  count?: number
}

const EMOJIS = ['🎻', '🎺', '🎷', '🎼', '🥁', '🎶', '🎵', '🪈', '🎹', '🪕']

type Particle = {
  id: string
  emoji: string
  leftPct: number
  sizePx: number
  delayMs: number
  driftPx: number
  swayMs: number
  riseMs: number
}

export default function OrchestraEmojiFloat({
  durationMs = 2500,
  count = 16,
}: Props) {
  const [show, setShow] = useState(true)

  // 初回表示だけ出して消す
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), durationMs)
    return () => window.clearTimeout(t)
  }, [durationMs])

  const particles = useMemo<Particle[]>(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

    return Array.from({ length: count }, (_, i) => ({
      id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
      emoji: pick(EMOJIS),
      leftPct: rand(5, 95),
      sizePx: rand(22, 46),
      delayMs: rand(0, 450),
      driftPx: rand(-40, 40),
      swayMs: rand(1200, 2200),
      riseMs: rand(1600, 2400),
    }))
  }, [count])

  if (!show) return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden z-[9999]"
    >
      {/* keyframes をここで定義（CSSファイル触りたくない場合） */}
      <style>{`
        @keyframes emojiRise {
          0%   { transform: translate3d(0, 0, 0); opacity: 0; }
          10%  { opacity: 0.95; }
          90%  { opacity: 0.9; }
          100% { transform: translate3d(var(--drift), -110vh, 0); opacity: 0; }
        }
        @keyframes emojiSway {
          0%   { transform: translateX(-8px) rotate(-4deg); }
          50%  { transform: translateX( 8px) rotate( 4deg); }
          100% { transform: translateX(-8px) rotate(-4deg); }
        }
      `}</style>

      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute bottom-[-10vh]"
          style={{
            left: `${p.leftPct}%`,
            fontSize: `${p.sizePx}px`,
            animation: `emojiRise ${p.riseMs}ms ease-in-out ${p.delayMs}ms forwards`,
            // CSS変数で横流れ量を渡す
            // @ts-ignore
            ['--drift' as any]: `${p.driftPx}px`,
            filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.08))',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              animation: `emojiSway ${p.swayMs}ms ease-in-out 0ms infinite`,
            }}
          >
            {p.emoji}
          </span>
        </div>
      ))}
    </div>
  )
}
