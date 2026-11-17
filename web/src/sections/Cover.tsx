import { wedding } from '../config/wedding'
import { formatLatinDate, formatKoreanDate } from '../lib/date'
import './Cover.css'

const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\/+/, '')

/** config 좌표 없이도 완성도 있게 보이도록 하는 원본 보태니컬 아치 (CSS/SVG). */
function BotanicalArch() {
  // 상단 아치를 따라 잎을 배치 (좌우 대칭)
  const cx = 160
  const cy = 250
  const r = 138
  const leaves: { x: number; y: number; rot: number; len: number; hue: 'leaf' | 'soft' }[] = []
  const start = -200 // deg
  const end = 20
  const steps = 15
  for (let i = 0; i <= steps; i++) {
    const t = start + ((end - start) * i) / steps
    const rad = (t * Math.PI) / 180
    const x = cx + r * Math.cos(rad)
    const y = cy + r * Math.sin(rad)
    const tangent = t + 90
    leaves.push({
      x,
      y,
      rot: i % 2 === 0 ? tangent + 26 : tangent - 26,
      len: i % 3 === 0 ? 20 : 15,
      hue: i % 2 === 0 ? 'leaf' : 'soft',
    })
  }
  return (
    <svg
      className="cover__arch"
      viewBox="0 0 320 320"
      role="img"
      aria-label="풀잎 장식"
      preserveAspectRatio="xMidYMin meet"
    >
      {/* 아치 줄기 */}
      <path
        d={`M ${cx + r * Math.cos((start * Math.PI) / 180)} ${cy + r * Math.sin((start * Math.PI) / 180)}
            A ${r} ${r} 0 0 1 ${cx + r * Math.cos((end * Math.PI) / 180)} ${cy + r * Math.sin((end * Math.PI) / 180)}`}
        fill="none"
        stroke="var(--leaf)"
        strokeWidth="1.4"
        opacity="0.5"
      />
      {leaves.map((lf, i) => (
        <g key={i} transform={`translate(${lf.x} ${lf.y}) rotate(${lf.rot})`}>
          <ellipse
            cx="0"
            cy={-lf.len / 2}
            rx={lf.len * 0.34}
            ry={lf.len / 2}
            fill={lf.hue === 'leaf' ? 'var(--leaf)' : 'var(--leaf-soft)'}
            opacity={lf.hue === 'leaf' ? 0.8 : 0.9}
          />
        </g>
      ))}
      {/* 금빛 작은 열매 */}
      {leaves
        .filter((_, i) => i % 4 === 1)
        .map((lf, i) => (
          <circle key={`b${i}`} cx={lf.x} cy={lf.y} r="2.4" fill="var(--gold)" opacity="0.8" />
        ))}
    </svg>
  )
}

export function Cover() {
  const { groom, bride, datetime, venue, coverImage } = wedding
  const date = new Date(datetime)

  return (
    <header className="cover">
      {coverImage ? (
        <div className="cover__photo-wrap">
          <img className="cover__photo" src={asset(coverImage)} alt="" width={430} height={560} />
          <div className="cover__photo-veil" />
        </div>
      ) : (
        <div className="cover__art" aria-hidden="true">
          <BotanicalArch />
        </div>
      )}

      <div className={`cover__inner${coverImage ? ' cover__inner--onphoto' : ''}`}>
        <p className="cover__eyebrow">우리, 결혼합니다</p>

        <div className="cover__names">
          <span className="cover__name">{groom.name}</span>
          <span className="cover__amp" aria-hidden="true">
            &amp;
          </span>
          <span className="cover__name">{bride.name}</span>
        </div>

        <div className="cover__meta">
          <p className="cover__date-latin">{formatLatinDate(date)}</p>
          <p className="cover__date-ko">{formatKoreanDate(date)}</p>
          <p className="cover__venue">
            {venue.name} · {venue.hall}
          </p>
        </div>
      </div>

      <span className="cover__scroll" aria-hidden="true">
        <span className="cover__scroll-dot" />
      </span>
    </header>
  )
}
