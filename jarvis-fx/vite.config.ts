import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * ARWES (vanilla packages @arwes/frames, @arwes/animated …) is written against
 * the Motion v10 API (`timeline`, `glide`). The app itself uses Motion 14 (motion/react).
 * Resolve `motion` to the aliased v10 copy only when the importer lives inside @arwes.
 */
const ARWES_IMPORTER = /[\\/]@arwes[\\/]/

function arwesMotionV10(): Plugin {
  return {
    name: 'jx:arwes-motion-v10',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === 'motion' && importer && ARWES_IMPORTER.test(importer)) {
        return this.resolve('motion-v10', importer, { ...options, skipSelf: true })
      }
      return null
    },
  }
}

/** Same redirect for the dependency pre-bundler (Rolldown), which does not run Vite plugins. */
const arwesMotionV10Optimizer = {
  name: 'jx:arwes-motion-v10-optimizer',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async resolveId(this: any, source: string, importer: string | undefined, options: any) {
    if (source === 'motion' && importer && ARWES_IMPORTER.test(importer)) {
      return this.resolve('motion-v10', importer, { ...options, skipSelf: true })
    }
    return null
  },
}

export default defineConfig({
  // Each parallel dev server can use its own optimizer cache (VITE_CACHE_DIR) to avoid clashes.
  cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  base: process.env.VITE_BASE ?? '/',
  plugins: [arwesMotionV10(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    rolldownOptions: { plugins: [arwesMotionV10Optimizer] },
  },
  server: { host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
