import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // The dev badge sits on top of the total bar, which is where the merchant looks.
  devIndicators: false,
  // Next writes AGENTS.md/CLAUDE.md into this app on every dev run; we keep our own docs.
  agentRules: false,
}

export default config
