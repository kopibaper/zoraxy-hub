import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-md-info-container">
        <Compass className="h-8 w-8 text-md-info" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-md-on-surface">Page not found</h2>
      <p className="mt-2 max-w-md text-sm text-md-on-surface-variant">
        The page you are looking for does not exist or may have moved.
      </p>
      <Link href="/" className="mt-6">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
