import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typedRoutes: true,
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false, child_process: false };
      config.resolve.alias = { ...config.resolve.alias, 'isomorphic-ws': require.resolve('./lib/isomorphic-ws-fix.mjs') };
    }
    return config;
  },
  serverExternalPackages: [
    '@midnight-ntwrk/midnight-js-contracts',
    '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
  ],
};

export default nextConfig;
