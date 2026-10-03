import sanityPluginKitOxlint from '@sanity/plugin-kit/oxlint'
import {defineConfig} from 'oxlint'

export default defineConfig({
  extends: [sanityPluginKitOxlint],
  // The Nuxt proxy example runs in a Nuxt app (auto-imports, h3), not in this package
  ignorePatterns: [...(sanityPluginKitOxlint.ignorePatterns ?? []), 'examples/**'],
})
