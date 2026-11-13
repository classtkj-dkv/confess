/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // firebase-admin harus dimuat sebagai paket Node biasa (bukan di-bundle webpack).
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    return [
      {
        // Service worker harus selalu diambil ulang agar pembaruan cepat sampai.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
