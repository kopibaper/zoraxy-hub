import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

function SkeletonBlock({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg skeleton-shimmer",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-2xl border border-md-outline-variant bg-md-surface p-5">
      <SkeletonBlock className="h-5 w-1/3" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-2/3" />
      <div className="pt-1">
        <SkeletonBlock className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-md-outline-variant bg-md-surface">
      <div className="grid grid-cols-4 gap-3 border-b border-md-outline-variant p-5">
        <SkeletonBlock className="h-4 w-20" />
        <SkeletonBlock className="h-4 w-16" />
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-4 w-14" />
      </div>
      <div className="divide-y divide-md-outline-variant">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-3 p-5">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-4/5" />
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-2xl border border-md-outline-variant bg-md-surface p-5">
      <SkeletonBlock className="h-5 w-40" />
      <div className="mt-4 flex h-52 items-end gap-3">
        {Array.from({ length: 10 }).map((_, index) => (
          <SkeletonBlock
            key={index}
            className="w-full rounded-t-lg"
            style={{ height: `${30 + ((index * 13) % 70)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
