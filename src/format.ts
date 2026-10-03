import type {DateRange} from './types'

const compactFormat = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const fullFormat = new Intl.NumberFormat()

export function formatCompact(value: number): string {
  return compactFormat.format(value)
}

export function formatNumber(value: number): string {
  return fullFormat.format(value)
}

const RANGE_LABELS: Record<DateRange, string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '6mo': 'last 6 months',
  '12mo': 'last 12 months',
}

export function describeRange(range: DateRange): string {
  return RANGE_LABELS[range]
}
