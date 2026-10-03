import type {DocumentBadgeComponent} from 'sanity'

import {describeRange, formatCompact, formatNumber} from './format'
import type {PlausibleStatsConfig} from './types'
import {usePageStats} from './usePageStats'

/**
 * Creates a document badge showing pageviews for the published document's path.
 * Badges are rendered as hooks by the Studio, so the badge can fetch its own data.
 *
 * @public
 */
export function createPlausibleBadge(config: PlausibleStatsConfig): DocumentBadgeComponent {
  const range = config.badgeRange ?? '30d'

  const PlausibleBadge: DocumentBadgeComponent = (props) => {
    // Stats describe the live page, so only the published version counts
    const path = props.published ? config.getPath(props.published) : null
    const {data} = usePageStats(config, path, range, {timeseries: false})

    if (!path || !data) return null
    const {visitors, pageviews} = data.totals
    return {
      label: `${formatCompact(pageviews)} ${pageviews === 1 ? 'view' : 'views'}`,
      title: `${formatNumber(visitors)} visitors · ${formatNumber(pageviews)} pageviews (${describeRange(range)}, ${path})`,
    }
  }
  PlausibleBadge.displayName = 'PlausibleBadge'

  return PlausibleBadge
}
