"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";

interface MetricsCardProps {
  label: string;
  value: string;
  className?: string;
}

export function MetricsCard({ label, value, className }: MetricsCardProps) {
  return (
    <Card className={clsx("w-full max-w-[200px] text-center shadow-sm border", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}