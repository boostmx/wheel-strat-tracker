"use client";
import { Portfolio } from "@/types";
import { PortfolioDetail } from "./PortfolioDetail";

export default function PortfolioPageClient({
  portfolio,
}: {
  portfolio: Portfolio;
}) {
  return <PortfolioDetail portfolio={portfolio} />;
}
