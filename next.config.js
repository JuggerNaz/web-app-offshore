/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  productionBrowserSourceMaps: false,
  typescript: {
    // Skip slow single-threaded type checking during `next build` (use `yarn typecheck` separately)
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  transpilePackages: ['geist'],
  // Prevent Webpack from bundling heavy server/cloud SDKs into API route bundles
  serverExternalPackages: [
    'oracledb',
    'pg',
    'googleapis',
    'cloudinary',
    '@aws-sdk/client-s3',
    '@aws-sdk/lib-storage',
    '@aws-sdk/s3-request-presigner',
    '@azure/msal-node',
  ],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'framer-motion',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },

  async redirects() {
    return [
      {
        source: '/platform',
        destination: '/dashboard/field/platform',
        permanent: true,
      },
      {
        source: '/platform/:path*',
        destination: '/dashboard/field/platform/:path*',
        permanent: true,
      },
      {
        source: '/platforms',
        destination: '/dashboard/field/platform',
        permanent: true,
      },
      {
        source: '/platforms/:path*',
        destination: '/dashboard/field/platform/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/platform',
        destination: '/dashboard/field/platform',
        permanent: true,
      },
      {
        source: '/dashboard/platform/:path*',
        destination: '/dashboard/field/platform/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/platforms',
        destination: '/dashboard/field/platform',
        permanent: true,
      },
      {
        source: '/dashboard/platforms/:path*',
        destination: '/dashboard/field/platform/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/field/platforms',
        destination: '/dashboard/field/platform',
        permanent: true,
      },
      {
        source: '/dashboard/field/platforms/:path*',
        destination: '/dashboard/field/platform/:path*',
        permanent: true,
      },
      {
        source: '/pipeline',
        destination: '/dashboard/field/pipeline',
        permanent: true,
      },
      {
        source: '/pipeline/:path*',
        destination: '/dashboard/field/pipeline/:path*',
        permanent: true,
      },
      {
        source: '/pipelines',
        destination: '/dashboard/field/pipeline',
        permanent: true,
      },
      {
        source: '/pipelines/:path*',
        destination: '/dashboard/field/pipeline/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/pipeline',
        destination: '/dashboard/field/pipeline',
        permanent: true,
      },
      {
        source: '/dashboard/pipeline/:path*',
        destination: '/dashboard/field/pipeline/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/pipelines',
        destination: '/dashboard/field/pipeline',
        permanent: true,
      },
      {
        source: '/dashboard/pipelines/:path*',
        destination: '/dashboard/field/pipeline/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/field/pipelines',
        destination: '/dashboard/field/pipeline',
        permanent: true,
      },
      {
        source: '/dashboard/field/pipelines/:path*',
        destination: '/dashboard/field/pipeline/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
