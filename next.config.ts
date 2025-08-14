// next.config.ts
import type { NextConfig } from "next";
import { execSync } from "node:child_process";
// tsconfig.json must have: "resolveJsonModule": true, "esModuleInterop": true
import pkg from "./package.json";

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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_VERSION: fullVersion },
};

export default nextConfig;