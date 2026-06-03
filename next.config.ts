import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We standardize on 127.0.0.1 for the Spotify OAuth redirect, so allow it as
  // a dev origin to avoid Next blocking HMR/dev resources on that host.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
