const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

const upstreamResolveRequest = config.resolver.resolveRequest;
const projectEntryAnchor = path.join(projectRoot, 'package.json');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isPinnedReact =
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-dom' ||
    moduleName.startsWith('react-dom/');

  const nextContext = isPinnedReact
    ? { ...context, originModulePath: projectEntryAnchor }
    : context;

  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(nextContext, moduleName, platform);
  }
  return context.resolveRequest(nextContext, moduleName, platform);
};

module.exports = config;
