// next.config.ts
import type { NextConfig } from "next";
import { execSync } from "node:child_process";
// tsconfig.json must have: "resolveJsonModule": true, "esModuleInterop": true
import pkg from "./package.json";
import createMDX from "@next/mdx";

function safe(cmd: string, fallback = "") {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  safe("git rev-parse --short HEAD", "local");

const baseVersion = (pkg as { version?: string }).version ?? "0.0.0";
const fullVersion =
  process.env.NODE_ENV === "production"
    ? `${baseVersion}+${sha}`
    : `${baseVersion}-dev+${sha}`;

// ✅ Wrap the Next config with MDX
const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_VERSION: fullVersion },

  // Helps Next use the Rust MDX compiler (faster, fewer edge issues)
  experimental: { mdxRs: true },

  // Not strictly required in App Router, but makes MDX discovery rock‑solid
  pageExtensions: ["ts", "tsx", "md", "mdx"],
};

export default withMDX(nextConfig);