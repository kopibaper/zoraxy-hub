import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <Compass className="h-12 w-12 text-blue-500" />
      <h2 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        The page you are looking for does not exist or may have moved.
      </p>
      <Link href="/" className="mt-5">
        <Button>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
