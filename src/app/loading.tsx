import {
  SkeletonCard,
  SkeletonChart,
  SkeletonTable,
} from "@/components/shared/loading-skeleton";

export default function Loading() {
  return (
    <div className="space-y-8 p-5 md:p-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg skeleton-shimmer" />
        <div className="h-4 w-80 rounded-lg skeleton-shimmer" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <SkeletonChart />
      <SkeletonTable rows={5} />
    </div>
  );
}
