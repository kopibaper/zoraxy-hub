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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-md-warning-container">
        <AlertTriangle className="h-8 w-8 text-md-warning" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-md-on-surface">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-md-on-surface-variant">
        We hit an unexpected issue while loading this page.
      </p>
      <Button className="mt-6" onClick={() => unstable_retry()}>
        Retry
      </Button>
    </div>
  );
}
