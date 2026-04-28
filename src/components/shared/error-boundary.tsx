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
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-md-outline-variant bg-md-surface p-8 text-center elevation-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-md-warning-container">
            <AlertTriangle className="h-7 w-7 text-md-warning" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-md-on-surface">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-md-on-surface-variant">
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
