/**
 * Proxies Plausible Stats API v2 queries for sanity-plugin-plausible-insights.
 *
 * The file has no `.post` suffix on purpose: CORS preflight (OPTIONS) requests must reach
 * this handler so `handleCors` can answer them. The API key never leaves the server.
 */
import {
  assertMethod,
  createError,
  defineEventHandler,
  handleCors,
  readBody,
  setResponseStatus,
} from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  const allowedOrigins = ['http://localhost:3333', config.plausibleStudioOrigin].filter(Boolean)

  // Answers preflight requests and sets CORS headers for allowed origins
  if (
    handleCors(event, {
      origin: allowedOrigins,
      methods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      maxAge: '600',
    })
  ) {
    return
  }

  assertMethod(event, 'POST')

  if (!config.plausibleApiKey || !config.plausibleSiteId) {
    throw createError({statusCode: 500, statusMessage: 'Plausible proxy is not configured'})
  }

  const body = await readBody<Record<string, unknown> | undefined>(event)
  if (!body || typeof body !== 'object') {
    throw createError({statusCode: 400, statusMessage: 'Expected a JSON body'})
  }
  if (body.site_id !== config.plausibleSiteId) {
    throw createError({statusCode: 403, statusMessage: 'site_id not allowed'})
  }

  const host = config.plausibleHost || 'https://plausible.io'
  const res = await fetch(`${host}/api/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.plausibleApiKey}`,
    },
    body: JSON.stringify(body),
  })

  // Pass Plausible's status and JSON (including `{error}` bodies) through to the Studio
  setResponseStatus(event, res.status)
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return {error: text || res.statusText}
  }
})
