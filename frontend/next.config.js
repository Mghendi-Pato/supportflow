/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker standalone build — produces a self-contained server.js
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
};

module.exports = nextConfig;
