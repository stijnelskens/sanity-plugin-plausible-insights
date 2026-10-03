# sanity-plugin-plausible-insights

Per-document [Plausible Analytics](https://plausible.io) stats in Sanity Studio, so editors can see how a page performs without leaving the document.

- **Badge**: shows views (for example "1.2K views") in the document footer of published documents, with visitors and pageviews in the tooltip.
- **Stats view**: a document view with the tracked path, a date range select, Visitors and Pageviews cards, and a pageviews sparkline.

It uses the [Plausible Stats API v2](https://plausible.io/docs/stats-api) through **your own proxy**, so the Plausible API key never reaches the browser.

> This plugin does not embed the shared Plausible dashboard. It queries the Stats API per page.

## Installation

```sh
npm install sanity-plugin-plausible-insights
```

Requires Sanity Studio v5 or v6 and React 19.

## 1. Create a Plausible API key

1. In Plausible, open **Account settings → API keys** and create a key of type **Stats API**.
2. Store it as a secret on the server that runs your proxy (for example `NUXT_PLAUSIBLE_API_KEY`).

**Never** put the key in a `SANITY_STUDIO_*` environment variable. Anything prefixed `SANITY_STUDIO_` is bundled into the Studio's JavaScript and visible to anyone who can load the Studio.

## 2. Set up the proxy

The Studio only talks to `config.endpoint`. That endpoint should:

1. Allow CORS from your Studio origins (the hosted Studio URL and `http://localhost:3333`) and answer preflight `OPTIONS` requests.
2. Accept `POST` only.
3. Reject any `site_id` other than your own (otherwise anyone could use your key to read other sites in your Plausible team).
4. Forward the JSON body to `https://plausible.io/api/v2/query` (or your self-hosted Plausible) with `Authorization: Bearer <key>`, and pass the status and body back.

A ready-made Nuxt/Nitro handler is in [`examples/nuxt-proxy/server/api/plausible/query.ts`](examples/nuxt-proxy/server/api/plausible/query.ts). Copy it into your Nuxt app and add the runtime config from [`examples/nuxt-proxy/nuxt.config.ts`](examples/nuxt-proxy/nuxt.config.ts):

```sh
NUXT_PLAUSIBLE_API_KEY=your-stats-api-key
NUXT_PLAUSIBLE_SITE_ID=example.com
NUXT_PLAUSIBLE_STUDIO_ORIGIN=https://my-project.sanity.studio
# NUXT_PLAUSIBLE_HOST=https://plausible.example.com   # self-hosted only
```

The file is named `query.ts`, not `query.post.ts`, on purpose. A `.post` route never sees the browser's `OPTIONS` preflight, so CORS would fail.

Any other server (Next.js route handler, Cloudflare Worker, Express) works the same way.

## 3. Share one config

Create `plausible.config.ts` next to `sanity.config.ts`. The plugin (badge) and the stats view both use it.

```ts
// plausible.config.ts
import type {PlausibleStatsConfig} from 'sanity-plugin-plausible-insights'

export const plausibleConfig: PlausibleStatsConfig = {
  siteId: 'example.com',
  endpoint: 'https://www.example.com/api/plausible/query',
  documentTypes: ['post', 'page'],
  badgeRange: '30d',
  getPath: (doc) => {
    const slug = (doc.slug as {current?: string} | undefined)?.current
    if (!slug) return null
    switch (doc._type) {
      case 'post':
        return `/blog/${slug}`
      case 'page':
        return slug === 'home' ? '/' : `/${slug}`
      default:
        return null
    }
  },
  // headers: {'x-proxy-token': '...'},  // optional; remember this is public too
}
```

| Option          | Type                                          | Default    | Description                                                                             |
| --------------- | --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `siteId`        | `string`                                      | (required) | Site domain as registered in Plausible.                                                 |
| `endpoint`      | `string`                                      | (required) | Your proxy URL.                                                                         |
| `getPath`       | `(doc: SanityDocumentLike) => string \| null` | (required) | Maps a document to the pathname Plausible tracks. Return `null` if it has no URL.       |
| `documentTypes` | `string[]`                                    | all types  | Document types that get the badge.                                                      |
| `badgeRange`    | `'7d' \| '30d' \| '6mo' \| '12mo'`            | `'30d'`    | Range used by the badge, and the initial range of the stats view.                       |
| `headers`       | `Record<string, string>`                      | none       | Extra headers sent to the proxy. They ship in the Studio bundle, so they aren't secret. |

Define the config once at module level, as above. The hook refetches when `headers` changes identity.

## 4. Wire it into `sanity.config.ts`

```ts
// sanity.config.ts
import {defineConfig} from 'sanity'
import {structureTool, type DefaultDocumentNodeResolver} from 'sanity/structure'
import {plausibleStats, PlausibleStatsView} from 'sanity-plugin-plausible-insights'

import {plausibleConfig} from './plausible.config'
import {schemaTypes} from './schemaTypes'

const defaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) => {
  if (plausibleConfig.documentTypes?.includes(schemaType)) {
    return S.document().views([
      S.view.form(),
      S.view.component(PlausibleStatsView).options(plausibleConfig).title('Stats'),
    ])
  }
  return S.document().views([S.view.form()])
}

export default defineConfig({
  name: 'default',
  projectId: '<projectId>',
  dataset: 'production',
  plugins: [
    structureTool({defaultDocumentNode}),
    plausibleStats(plausibleConfig), // registers the badge
  ],
  schema: {types: schemaTypes},
})
```

## Exports

| Export                              | What it is                                                               |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `plausibleStats(config)`            | Studio plugin that registers the badge.                                  |
| `PlausibleStatsView`                | Document view component (`UserViewComponent<PlausibleStatsConfig>`).     |
| `createPlausibleBadge(config)`      | The badge on its own, if you want to compose `document.badges` yourself. |
| `usePageStats(config, path, range)` | Hook that powers both, for custom UIs.                                   |
| `clearStatsCache()`                 | Clears the in-memory response cache.                                     |

## Caveats

- **Exact path matching.** The plugin filters on `["is", "event:page", [path]]`, which is an exact match. `/blog/foo` and `/blog/foo/` are different pages, and so are `/blog/foo` and `/en/blog/foo`. `getPath` must return exactly what Plausible records, including trailing slashes and locale prefixes. Check the Pages report in Plausible if the numbers look too low. For localized sites, return the path for the document's own locale.
- **Published only.** Stats describe the live page, so the path comes from the **published** document. Unpublished documents show "Publish this document to start collecting stats." If the draft changes the slug, the view shows which path will be tracked after publishing. Old URLs aren't merged, so stats restart at zero after a slug change.
- **Caching.** Responses are cached in memory for 5 minutes, keyed by endpoint and full request payload. The badge and the view share the cache, and identical in-flight requests are deduplicated. Reload the Studio (or call `clearStatsCache()`) to force fresh numbers. Plausible's default rate limit is 600 requests per hour per API key. Caching at the proxy is a good idea for large teams.
- **Gaps in the sparkline.** Plausible omits empty time buckets. The plugin requests `include.time_labels` and fills missing buckets with zero.
- **Visitors** in the view and badge are unique visitors for the selected range. They are not a sum of daily visitors.

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit) with the default build and watch scripts.

```sh
pnpm build       # pkg-utils build with --strict --check
pnpm lint        # oxlint (type-aware)
pnpm typecheck   # tsc
pnpm format      # oxfmt
```

### Test locally in a Studio

The kit's recommended workflow uses [yalc](https://github.com/wclr/yalc):

1. In this repo, run `pnpm link-watch`. It builds on change and pushes to the local yalc store. The first run prints the exact command for the Studio.
2. In your Studio, run `npx yalc add sanity-plugin-plausible-insights && npx yalc link sanity-plugin-plausible-insights && npm install` (with yarn: `yalc add --link sanity-plugin-plausible-insights && yarn install`).
3. Add `plausible.config.ts` and the `sanity.config.ts` wiring above, then run `npx sanity dev` (http://localhost:3333).
4. Run the proxy locally. For example, put the Nuxt handler in your site and run `npm run dev`, then point `endpoint` at `http://localhost:3000/api/plausible/query`. `http://localhost:3333` is already in the CORS allowlist.
5. Open a published `post` or `page`. You should see the views badge in the footer and a **Stats** tab. Check the browser's network tab: requests should only go to your proxy, never to `plausible.io`.

When you're done, run `npx yalc remove sanity-plugin-plausible-insights && npm install` in the Studio.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugins/tree/main/packages/@sanity/plugin-kit#testing-a-plugin-in-sanity-studio) for details.

## License

[MIT](LICENSE) © Stijn E
