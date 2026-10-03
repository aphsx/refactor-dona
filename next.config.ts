import type { NextConfig } from "next";
import { getApiOrigin } from "./lib/env";

const apiOrigin = getApiOrigin();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
