import {useEffect, useState} from 'react'

import {fetchPageStats, isAbortError} from './api'
import type {DateRange, PageStats, PlausibleStatsConfig} from './types'

/** @public */
export interface PageStatsState {
  /** Latest stats for `path`. Kept while a new range loads so the UI can dim it. */
  data: PageStats | null
  error: Error | null
  loading: boolean
}

interface Settled {
  /** Identifies the request that produced this result */
  key: string
  path: string
  data: PageStats | null
  error: Error | null
}

const IDLE: PageStatsState = {data: null, error: null, loading: false}

/**
 * Fetches stats for a pathname. Pass `null` as `path` to skip fetching.
 * Pending requests are cancelled on unmount and when any input changes.
 *
 * @public
 */
export function usePageStats(
  config: PlausibleStatsConfig,
  path: string | null,
  range: DateRange,
  options: {timeseries?: boolean} = {},
): PageStatsState {
  const timeseries = options.timeseries ?? true
  const {siteId, endpoint, headers} = config
  const key = JSON.stringify([siteId, endpoint, path, range, timeseries])
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    if (!path) return undefined
    const controller = new AbortController()

    const load = async () => {
      try {
        const data = await fetchPageStats({siteId, endpoint, headers}, path, range, {
          timeseries,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) setSettled({key, path, data, error: null})
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return
        const error = err instanceof Error ? err : new Error(String(err))
        // Keep the last data for this path so the view can still show it
        setSettled((prev) => ({key, path, data: prev?.path === path ? prev.data : null, error}))
      }
    }
    void load()

    return () => controller.abort()
  }, [key, siteId, endpoint, headers, path, range, timeseries])

  if (!path) return IDLE
  const loading = settled?.key !== key
  return {
    data: settled?.path === path ? settled.data : null,
    error: loading ? null : (settled?.error ?? null),
    loading,
  }
}
