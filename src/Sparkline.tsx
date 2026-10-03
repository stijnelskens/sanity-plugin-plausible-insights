import {Box} from '@sanity/ui'
import {useId} from 'react'

import type {TimeseriesPoint} from './types'

const WIDTH = 300
const PADDING = 2

/** Minimal pageviews trend line, coloured with the Studio theme's CSS variables. */
export function Sparkline(props: {points: TimeseriesPoint[]; height?: number; label: string}) {
  const {points, height = 48, label} = props
  const gradientId = useId()
  const titleId = useId()

  if (points.length < 2) return null

  const max = Math.max(1, ...points.map((p) => p.pageviews))
  const step = WIDTH / (points.length - 1)
  const y = (value: number) => PADDING + (height - PADDING * 2) * (1 - value / max)
  const line = points.map((p, i) => `${(i * step).toFixed(2)},${y(p.pageviews).toFixed(2)}`)
  const area = `M0,${height} L${line.join(' L')} L${WIDTH},${height} Z`

  return (
    <Box>
      <svg
        aria-labelledby={titleId}
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        style={{display: 'block', overflow: 'visible'}}
      >
        <title id={titleId}>{label}</title>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--card-accent-fg-color)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--card-accent-fg-color)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line
          x1={0}
          x2={WIDTH}
          y1={height - 0.5}
          y2={height - 0.5}
          stroke="var(--card-border-color)"
          vectorEffect="non-scaling-stroke"
        />
        <path d={area} fill={`url(#${gradientId})`} />
        <polyline
          points={line.join(' ')}
          fill="none"
          stroke="var(--card-accent-fg-color)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </Box>
  )
}
