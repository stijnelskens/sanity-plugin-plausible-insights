import {definePlugin} from 'sanity'

import {createPlausibleBadge} from './PlausibleBadge'
import type {PlausibleStatsConfig} from './types'

export {clearStatsCache} from './api'
export {createPlausibleBadge} from './PlausibleBadge'
export {PlausibleStatsView} from './PlausibleStatsView'
export type {DateRange, PageStats, PageTotals, PlausibleStatsConfig, TimeseriesPoint} from './types'
export {type PageStatsState, usePageStats} from './usePageStats'

function assertConfig(config: PlausibleStatsConfig | undefined): asserts config {
  if (!config) throw new Error('plausibleStats: missing config')
  if (!config.siteId) throw new Error('plausibleStats: `siteId` is required')
  if (!config.endpoint) throw new Error('plausibleStats: `endpoint` is required')
  if (typeof config.getPath !== 'function') {
    throw new Error('plausibleStats: `getPath` must be a function')
  }
}

/**
 * Adds a Plausible pageviews badge to published documents.
 * Add the stats view separately with `PlausibleStatsView` in `defaultDocumentNode`.
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {plausibleStats} from 'sanity-plugin-plausible-insights'
 * import {plausibleConfig} from './plausible.config'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [plausibleStats(plausibleConfig)],
 * })
 * ```
 *
 * @public
 */
export const plausibleStats = definePlugin<PlausibleStatsConfig>((config) => {
  assertConfig(config)
  const badge = createPlausibleBadge(config)
  const types = config.documentTypes

  return {
    name: 'sanity-plugin-plausible-insights',
    document: {
      badges: (prev, context) =>
        !types || types.includes(context.schemaType) ? [...prev, badge] : prev,
    },
  }
})
