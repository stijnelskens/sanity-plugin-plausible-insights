import {Box, Card, Flex, Grid, Label, Select, Spinner, Stack, Text} from '@sanity/ui'
import {Code} from '@sanity/ui/code'
import {type ChangeEvent, useCallback, useState} from 'react'
import type {UserViewComponent} from 'sanity/structure'

import {timeDimension} from './api'
import {describeRange, formatNumber} from './format'
import {Sparkline} from './Sparkline'
import {DATE_RANGES, type DateRange, type PlausibleStatsConfig, type TimeseriesPoint} from './types'
import {usePageStats} from './usePageStats'

function isDateRange(value: string): value is DateRange {
  return DATE_RANGES.some((r) => r.value === value)
}

function Message(props: {children: string}) {
  return (
    <Card padding={4} radius={2} tone="transparent" border>
      <Text muted size={1}>
        {props.children}
      </Text>
    </Card>
  )
}

function MetricCard(props: {title: string; value: number}) {
  return (
    <Card padding={3} radius={2} border>
      <Stack gap={3}>
        <Label muted size={1}>
          {props.title}
        </Label>
        <Text size={4} weight="semibold">
          {formatNumber(props.value)}
        </Text>
      </Stack>
    </Card>
  )
}

function describeTrend(points: TimeseriesPoint[], range: DateRange): string {
  const unit = timeDimension(range) === 'time:day' ? 'day' : 'week'
  const peak = Math.max(0, ...points.map((p) => p.pageviews))
  return `Pageviews per ${unit}, ${describeRange(range)}. Peak ${formatNumber(peak)}.`
}

/**
 * Document view showing Plausible stats for the published document.
 * Add it with `S.view.component(PlausibleStatsView).options(config).title('Stats')`.
 *
 * @public
 */
export const PlausibleStatsView: UserViewComponent<PlausibleStatsConfig> = (props) => {
  const {document, options: config} = props
  const [range, setRange] = useState<DateRange>(config?.badgeRange ?? '30d')
  const handleRangeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.currentTarget.value
    if (isDateRange(value)) setRange(value)
  }, [])

  // Stats describe the live page, so the path comes from the published document
  const published = document.published
  const path = config && published ? config.getPath(published) : null
  // The draft may change the URL; show it so editors know what changes on publish
  const displayedPath = config
    ? config.getPath({_id: props.documentId, _type: props.schemaType.name, ...document.displayed})
    : null

  // Hooks must run unconditionally; a null path skips the request
  const {data, error, loading} = usePageStats(
    config ?? {siteId: '', endpoint: '', getPath: () => null},
    path,
    range,
  )

  if (!config) {
    return (
      <Box padding={4}>
        <Message>
          Missing config. Pass your Plausible config with .options(config) when adding this view.
        </Message>
      </Box>
    )
  }

  if (!published) {
    return (
      <Box padding={4}>
        <Message>Publish this document to start collecting stats.</Message>
      </Box>
    )
  }

  if (!path) {
    return (
      <Box padding={4}>
        <Message>This document has no public URL yet. Add a slug and publish it.</Message>
      </Box>
    )
  }

  const unit = timeDimension(range) === 'time:day' ? 'day' : 'week'

  return (
    <Box padding={4}>
      <Stack gap={4}>
        <Flex align="flex-end" gap={3} wrap="wrap">
          <Stack flex={1} gap={2} style={{minWidth: 0}}>
            <Label muted size={1}>
              Tracked path
            </Label>
            <Code size={1} style={{overflowWrap: 'anywhere'}}>
              {path}
            </Code>
          </Stack>
          <Box style={{minWidth: 160}}>
            <Select
              aria-label="Date range"
              fontSize={1}
              padding={2}
              value={range}
              onChange={handleRangeChange}
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.title}
                </option>
              ))}
            </Select>
          </Box>
        </Flex>

        {displayedPath && displayedPath !== path && (
          <Card padding={3} radius={2} tone="caution" border>
            <Text size={1}>
              After publishing, stats will be tracked for <code>{displayedPath}</code>.
            </Text>
          </Card>
        )}

        {error && (
          <Card padding={3} radius={2} tone="critical" border>
            <Stack gap={3}>
              <Text size={1} weight="semibold">
                Couldn’t load stats
              </Text>
              <Text size={1}>{error.message}</Text>
            </Stack>
          </Card>
        )}

        {!data && loading && (
          <Flex justify="center" padding={5}>
            <Spinner muted />
          </Flex>
        )}

        {data && (
          <Stack
            gap={4}
            aria-busy={loading}
            style={{opacity: loading ? 0.5 : 1, transition: 'opacity 150ms ease'}}
          >
            <Grid gridTemplateColumns={2} gap={3}>
              <MetricCard title="Visitors" value={data.totals.visitors} />
              <MetricCard title="Pageviews" value={data.totals.pageviews} />
            </Grid>
            {data.timeseries.length > 1 && (
              <Card padding={3} radius={2} border>
                <Stack gap={3}>
                  <Label muted size={1}>
                    Pageviews per {unit}
                  </Label>
                  <Sparkline
                    points={data.timeseries}
                    label={describeTrend(data.timeseries, range)}
                  />
                </Stack>
              </Card>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
