import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Since the latest update to nextjs of this project, I cannot upload more than 10mb database.
    middlewareClientMaxBodySize: '100mb',
  },
};

export default nextConfig;
