import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    // No manualChunks on purpose.
    //
    // The lazy boundaries in the app (Scene, HotspotPanels, each XP app)
    // already describe exactly what should be split, and Rollup derives chunks
    // from that graph correctly. Hand-written vendor groups actively hurt
    // here: naming an `r3f` chunk made Rollup fold react-dom into it, so the
    // entry had to statically import from a chunk that statically imports
    // three — which put a modulepreload for the whole 3D runtime in index.html
    // and made every phone visitor download it just to see the résumé gate
    // (plan §9, §10). Verify with `npm run build` and check that index.html
    // does not preload the three chunk.
  },
})
