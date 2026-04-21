import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "servmoisst.btsinfo.nc",
    "api.servmoisst.btsinfo.nc",
  ],
};

export default nextConfig;
