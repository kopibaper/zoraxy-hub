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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
      <Icon className="h-12 w-12 text-zinc-400" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {actionLabel ? (
        actionHref ? (
          <Button className="mt-4" asChild>
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : onAction ? (
          <Button className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null
      ) : null}
    </div>
  );
}
