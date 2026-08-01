import type { NextConfig } from "next";

const isPagesExport = process.env.PAGES_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isPagesExport
    ? {
        output: "export" as const,
        basePath: "/press-here",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
