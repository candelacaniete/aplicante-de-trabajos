import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: dir,
  serverExternalPackages: [
    "playwright",
    "googleapis",
    "unpdf",
    "mammoth",
    "@anthropic-ai/sdk",
  ],
  turbopack: {
    root: dir,
    resolveAlias: {
      "@shared": path.join(dir, "shared"),
      "@cv-generator": path.join(dir, "cv-generator"),
      "@automation": path.join(dir, "automation"),
    },
  },
};

export default nextConfig;
