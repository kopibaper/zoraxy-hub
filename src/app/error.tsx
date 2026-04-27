"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        We hit an unexpected issue while loading this page.
      </p>
      <Button className="mt-5" onClick={() => unstable_retry()}>
        Retry
      </Button>
    </div>
  );
}
