import type {SanityDocumentLike} from 'sanity'

/** @public */
export type DateRange = '7d' | '30d' | '6mo' | '12mo'

/** @public */
export interface PlausibleStatsConfig {
  /** Site domain as registered in Plausible, e.g. `"example.com"` */
  siteId: string
  /** URL of your own proxy that forwards the request body to Plausible's `/api/v2/query` */
  endpoint: string
  /** Maps a document to the pathname Plausible tracks for it. Return `null` when it has no public URL. */
  getPath: (doc: SanityDocumentLike) => string | null
  /** Only show the badge on these document types. Defaults to all types. */
  documentTypes?: string[]
  /** Date range used by the badge. Defaults to `'30d'`. */
  badgeRange?: DateRange
  /** Extra headers sent to the proxy */
  headers?: Record<string, string>
}

/** @public */
export interface PageTotals {
  visitors: number
  pageviews: number
}

/** @public */
export interface TimeseriesPoint {
  /** Bucket start date as returned by Plausible, e.g. `"2024-01-01"` */
  date: string
  pageviews: number
}

/** @public */
export interface PageStats {
  totals: PageTotals
  /** Empty when the timeseries was not requested */
  timeseries: TimeseriesPoint[]
}

export const DATE_RANGES: {value: DateRange; title: string}[] = [
  {value: '7d', title: 'Last 7 days'},
  {value: '30d', title: 'Last 30 days'},
  {value: '6mo', title: 'Last 6 months'},
  {value: '12mo', title: 'Last 12 months'},
]
