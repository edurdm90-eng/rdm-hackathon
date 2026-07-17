// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("path");
const { createRequire } = require("module");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

const privyExpoRequire = createRequire(require.resolve("@privy-io/expo"));
const privyCoreRequire = createRequire(privyExpoRequire.resolve("@privy-io/js-sdk-core"));
const josePackageJson = privyCoreRequire.resolve("jose/package.json");
const joseBrowserEntry = path.join(path.dirname(josePackageJson), "dist/browser/index.js");
const workerThreadsShim = path.join(__dirname, "shims/node-worker-threads.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "jose") {
    return {
      type: "sourceFile",
      filePath: joseBrowserEntry,
    };
  }

  if (moduleName === "node:worker_threads" || moduleName === "worker_threads") {
    return {
      type: "sourceFile",
      filePath: workerThreadsShim,
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
