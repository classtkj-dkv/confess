/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // firebase-admin harus dimuat sebagai paket Node biasa (bukan di-bundle webpack).
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
