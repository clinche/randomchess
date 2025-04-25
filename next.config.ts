import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'export',
  
  // Configure basePath and assetPrefix for GitHub Pages
  basePath: process.env.NODE_ENV === 'production' ? '/randomchess' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/randomchess/' : '',
  
  // Add security headers for SharedArrayBuffer support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  
};

export default nextConfig;
