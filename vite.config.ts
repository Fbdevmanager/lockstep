import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Project Pages: https://<user>.github.io/<repo>/ — CI sets GITHUB_PAGES_BASE="/<repo>/"
const base = process.env.GITHUB_PAGES_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  base,
})
