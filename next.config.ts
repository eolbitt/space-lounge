import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "montreal-istanbul-wedding-falling.trycloudflare.com",
    "acer-hansen-aquatic-groove.trycloudflare.com",
    "*.trycloudflare.com",
  ],
  devIndicators: false,
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
