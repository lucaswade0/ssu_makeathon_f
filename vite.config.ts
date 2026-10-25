import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Tests read App.css as text to check rules like reduced motion; other CSS stays switched off in tests.
  test: { css: { include: [/App\.css/] } },
})
