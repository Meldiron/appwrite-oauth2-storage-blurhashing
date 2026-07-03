import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// node-appwrite ships for Node and pulls in `undici`. In the browser we alias it
// to a thin shim backed by the platform's native fetch/FormData/File so the
// official Node SDK runs client-side (as the task requires).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: [
      {
        find: 'undici',
        replacement: fileURLToPath(new URL('./src/shims/undici.js', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    include: ['node-appwrite'],
  },
})
