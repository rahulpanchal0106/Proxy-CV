/** @type {import('next').NextConfig} */
const nextConfig = {
  // This tells Next.js NOT to bundle this older library
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;