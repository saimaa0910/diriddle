import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@diriddle/shared-types'],
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
