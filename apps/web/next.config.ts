import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // The dev badge sits on top of the total bar, which is where the merchant looks.
  devIndicators: false,
  // Next writes AGENTS.md/CLAUDE.md into this app on every dev run; we keep our own docs.
  agentRules: false,
  // A self-contained server for the Docker image (Dockerfile.web), traced from the monorepo root.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
}

export default config
