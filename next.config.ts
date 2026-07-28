import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: Next 16 blocks cross-origin requests to dev resources, which
  // breaks hydration when the app is opened from a phone (LAN IP) or the
  // Android emulator (10.0.2.2). Update the LAN IP if your network changes.
  allowedDevOrigins: ["10.0.2.2", "192.168.0.114", "192.168.*.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
