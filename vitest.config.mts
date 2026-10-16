import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests vitest du frontend : uniquement les dossiers __tests__ (vecteurs
// communs avec le serveur). Les autres *.test.ts sont des scripts tsx
// (npm run test:unit) et ne doivent pas etre ramasses ici.
export default defineConfig({
  resolve: {
    // Meme alias que tsconfig.json ("@/*" -> racine du projet).
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
})
