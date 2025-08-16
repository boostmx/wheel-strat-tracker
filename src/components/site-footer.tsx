// src/components/site-footer.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Github, Mail } from "lucide-react";
import { VersionBadge } from "./version-badge";

const APP_NAME = "Trade Tracker";
//const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "v0.1.0";
const YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="HL Financial Strategies"
                width={20}
                height={20}
                className="opacity-90 dark:opacity-100"
              />
              <span className="font-semibold tracking-tight">{APP_NAME}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              A lightweight dashboard for tracking wheel and options trades.
            </p>
            <p className="text-xs text-muted-foreground">
              © {YEAR} HL Financial Strategies — For educational purposes only.
              Not financial advice.
            </p>
            <p className="text-xs text-muted-foreground italic">
              Version: <VersionBadge />
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">
              Navigate
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/overview"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/summary"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Account Summary
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources / Feedback */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/changelog"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <a
                  href="mailto:ceo@hlfinancialstrategies.com?subject=Trade%20Tracker%20Feedback"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  Feedback
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/boostmx/wheel-strat-tracker"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
