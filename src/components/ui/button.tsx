"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default:
    "bg-primary text-white shadow-sm hover:bg-primary/90 focus-visible:ring-primary/40",
  outline:
    "border border-white/60 bg-white/40 text-[#1a1c24] hover:bg-white/70",
  ghost: "bg-transparent text-[#3b3f4c] hover:bg-white/40",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button };
