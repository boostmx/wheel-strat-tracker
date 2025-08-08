// components/trade-detail-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function TradeDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
