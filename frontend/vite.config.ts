import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Reads .env from the repo root (../.env) so frontend and backend share one secrets file.
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
})
