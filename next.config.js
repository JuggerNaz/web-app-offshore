/** @type {import('next').NextConfig} */
// Trigger recompile
const nextConfig = {
  serverExternalPackages: ['oracledb'],
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
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
