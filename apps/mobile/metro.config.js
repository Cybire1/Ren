// The app installs with npm on its own, outside the pnpm workspace, and reaches
// @kova/monad through a `file:` symlink. Metro needs to watch the repo root so it can follow
// that link, and must keep normal node_modules lookup so npm's nested packages resolve.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)
config.watchFolders = [workspaceRoot]

// @kova/monad imports viem. Resolve them from the app, not from the package's own
// pnpm copy, so the bundle carries one viem and values cross the boundary cleanly.
const shared = ['viem', 'ox']
const appPackage = path.join(projectRoot, 'package.json')
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const root = moduleName.split('/')[0]
  if (shared.includes(root))
    return context.resolveRequest({ ...context, originModulePath: appPackage }, moduleName, platform)
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
