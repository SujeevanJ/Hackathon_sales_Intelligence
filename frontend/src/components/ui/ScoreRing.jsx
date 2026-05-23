import { useEffect, useRef } from 'react'

export function ScoreRing({ score, size = 80 }) {
  const circleRef = useRef(null)
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 70 ? '#10b981' :
    score >= 40 ? '#f59e0b' : '#ef4444'

  const textColor =
    score >= 70 ? 'text-emerald-400' :
    score >= 40 ? 'text-amber-400' : 'text-red-400'

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.style.strokeDashoffset = circumference
      requestAnimationFrame(() => {
        if (circleRef.current) {
          circleRef.current.style.transition = 'stroke-dashoffset 1s ease-out'
          circleRef.current.style.strokeDashoffset = offset
        }
      })
    }
  }, [score, offset, circumference])

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="5"
        />
        {/* Score ring */}
        <circle
          ref={circleRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold leading-none ${textColor}`} style={{ fontSize: size * 0.22 }}>
          {score}
        </span>
        <span className="text-slate-500 font-mono leading-none" style={{ fontSize: size * 0.12 }}>
          /100
        </span>
      </div>
    </div>
  )
}
