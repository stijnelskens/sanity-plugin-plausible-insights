// Only the parts relevant to the Plausible proxy
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only. Set via NUXT_PLAUSIBLE_API_KEY etc. Never expose these under `public`.
    plausibleApiKey: '',
    plausibleSiteId: '', // e.g. "example.com"
    plausibleHost: '', // optional, for self-hosted Plausible; defaults to https://plausible.io
    plausibleStudioOrigin: '', // e.g. "https://my-project.sanity.studio"
  },
})
