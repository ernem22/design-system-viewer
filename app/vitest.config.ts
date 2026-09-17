import { defineConfig } from 'vitest/config'

// Default environment stays `node`: the lib suites build their own happy-dom
// Window and import react-dom lazily so it never observes a document-less
// module scope. A test that wants a ready-made DOM opts in per file with a
// `// @vitest-environment happy-dom` docblock -- see shell/Toasts.test.tsx.
//
// `.tsx` must be in `include`. It is not implied by the `.ts` glob, and a
// component test named *.test.tsx was previously collected by nothing while
// the suite still exited 0 -- a silent pass, not a failure.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
