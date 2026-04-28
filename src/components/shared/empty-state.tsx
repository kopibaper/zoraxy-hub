import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-md-outline-variant py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-md-surface-container">
        <Icon className="h-7 w-7 text-md-on-surface-variant" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-md-on-surface">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-md-on-surface-variant">
        {description}
      </p>
      {actionLabel ? (
        actionHref ? (
          <Button className="mt-5" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : onAction ? (
          <Button className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      ) : null}
    </div>
  );
}
