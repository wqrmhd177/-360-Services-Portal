/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bind to localhost only to avoid permission issues
  async rewrites() {
    return [];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uengcejyjagdcqecnlkr.supabase.co",
        pathname: "/storage/v1/object/public/**"
      }
    ]
  }
};

export default nextConfig;

