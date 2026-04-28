"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-md-outline bg-md-surface px-4 py-2 text-sm text-md-on-surface transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-md-on-surface-variant/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:border-md-primary disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
