import { defineConfig } from 'vitest/config'

// Minimal node-environment setup for lib round-trip tests (issue 13 slice).
// No plugins needed — urlState.ts has no JSX or CSS imports.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
