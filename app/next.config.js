/** @type {import('next').NextConfig} */
const nextConfig = {
  // Отключаем экспериментальный Turbopack в Next.js 15
  experimental: {
    turbo: false,
  },
};

module.exports = nextConfig;
