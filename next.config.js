/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@google-analytics/data'],
  },
};

module.exports = nextConfig;
