"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-md-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-md-primary text-md-on-primary",
        secondary: "border-transparent bg-md-secondary-container text-md-on-secondary-container",
        destructive: "border-transparent bg-md-error text-white",
        outline: "border-md-outline text-md-on-surface",
        success: "border-transparent bg-md-success-container text-md-on-success-container",
        warning: "border-transparent bg-md-warning-container text-md-on-warning-container",
        danger: "border-transparent bg-md-error-container text-md-on-error-container",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
