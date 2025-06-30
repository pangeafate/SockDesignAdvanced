/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/SockDesignAdvanced',
  assetPrefix: '/SockDesignAdvanced/',
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig 