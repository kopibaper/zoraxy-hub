"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-xl font-semibold">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            {this.props.fallbackDescription ??
              "An unexpected error occurred while rendering this section. Try again."}
          </p>
          <Button className="mt-5" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
