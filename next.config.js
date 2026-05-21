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
};

module.exports = nextConfig;
