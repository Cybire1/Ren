import { defineConfig } from 'vitest/config'

/**
 * End-to-end tests run against the chain the deployment is configured for (KOVA_CHAIN): the
 * `*.tempo.e2e` files on Tempo, the `*.monad.e2e` files on Monad. Everything else runs on both.
 */
const chain = process.env.KOVA_CHAIN === 'monad' ? 'monad' : 'tempo'
const other = chain === 'tempo' ? 'monad' : 'tempo'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: [`test/**/*.${other}.e2e.test.ts`, '**/node_modules/**'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
