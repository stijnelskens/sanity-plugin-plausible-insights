import type {DateRange, PageStats, PageTotals, PlausibleStatsConfig, TimeseriesPoint} from './types'

/** The parts of the config that affect requests */
export type ProxyConfig = Pick<PlausibleStatsConfig, 'siteId' | 'endpoint' | 'headers'>

const CACHE_TTL_MS = 5 * 60 * 1000

interface QueryBody {
  site_id: string
  metrics: string[]
  date_range: DateRange
  filters: unknown[]
  dimensions?: string[]
  include?: {time_labels?: boolean}
}

interface QueryResponse {
  results: {metrics: number[]; dimensions: string[]}[]
  meta?: {time_labels?: string[]}
}

interface CacheEntry {
  expires: number
  promise: Promise<QueryResponse>
}

const cache = new Map<string, CacheEntry>()

/** Clears the in-memory response cache. */
export function clearStatsCache(): void {
  cache.clear()
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const json: unknown = JSON.parse(text)
    if (json && typeof json === 'object' && 'error' in json) {
      const err = json.error
      if (typeof err === 'string') return err
      if (err && typeof err === 'object' && 'message' in err) return String(err.message)
    }
  } catch {
    // Not JSON, fall through to the raw text
  }
  return text.trim() || res.statusText || 'Request failed'
}

async function fetchQuery(config: ProxyConfig, body: QueryBody): Promise<QueryResponse> {
  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', ...config.headers},
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Plausible request failed (${res.status}): ${await readError(res)}`)
  }
  const json: unknown = await res.json()
  if (!isQueryResponse(json)) {
    throw new Error('Unexpected response from the Plausible proxy: missing "results"')
  }
  return json
}

function isQueryResponse(value: unknown): value is QueryResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'results' in value &&
    Array.isArray(value.results)
  )
}

/**
 * Runs a query through the proxy. Responses are cached for five minutes, keyed by the
 * endpoint and the full request payload, and identical in-flight requests are shared.
 * Aborting `signal` only detaches this caller; the shared request still fills the cache.
 */
function query(config: ProxyConfig, body: QueryBody, signal?: AbortSignal): Promise<QueryResponse> {
  const key = JSON.stringify([config.endpoint, body])
  const now = Date.now()
  let entry = cache.get(key)
  if (!entry || entry.expires <= now) {
    const promise = fetchQuery(config, body)
    entry = {expires: now + CACHE_TTL_MS, promise}
    cache.set(key, entry)
    // Don't keep failures around
    promise.catch(() => {
      if (cache.get(key)?.promise === promise) cache.delete(key)
    })
  }
  return withSignal(entry.promise, signal)
}

async function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) throw abortError()
  let onAbort = () => {}
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, {once: true})
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError')
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function pageFilter(path: string): unknown[] {
  return [['is', 'event:page', [path]]]
}

export async function fetchTotals(
  config: ProxyConfig,
  path: string,
  range: DateRange,
  signal?: AbortSignal,
): Promise<PageTotals> {
  const res = await query(
    config,
    {
      site_id: config.siteId,
      metrics: ['visitors', 'pageviews'],
      date_range: range,
      filters: pageFilter(path),
    },
    signal,
  )
  const [visitors = 0, pageviews = 0] = res.results[0]?.metrics ?? []
  return {visitors, pageviews}
}

export function timeDimension(range: DateRange): 'time:day' | 'time:week' {
  return range === '7d' || range === '30d' ? 'time:day' : 'time:week'
}

export async function fetchTimeseries(
  config: ProxyConfig,
  path: string,
  range: DateRange,
  signal?: AbortSignal,
): Promise<TimeseriesPoint[]> {
  const res = await query(
    config,
    {
      site_id: config.siteId,
      metrics: ['pageviews'],
      date_range: range,
      filters: pageFilter(path),
      dimensions: [timeDimension(range)],
      // Plausible omits empty buckets; time_labels lets us fill them with zeros
      include: {time_labels: true},
    },
    signal,
  )
  const byDate = new Map<string, number>()
  for (const row of res.results) {
    const date = row.dimensions[0]
    if (date !== undefined) byDate.set(date, row.metrics[0] ?? 0)
  }
  const labels = res.meta?.time_labels ?? [...byDate.keys()].sort()
  return labels.map((date) => ({date, pageviews: byDate.get(date) ?? 0}))
}

export async function fetchPageStats(
  config: ProxyConfig,
  path: string,
  range: DateRange,
  options: {timeseries?: boolean; signal?: AbortSignal} = {},
): Promise<PageStats> {
  const {timeseries = true, signal} = options
  const [totals, series] = await Promise.all([
    fetchTotals(config, path, range, signal),
    timeseries ? fetchTimeseries(config, path, range, signal) : Promise.resolve([]),
  ])
  return {totals, timeseries: series}
}
