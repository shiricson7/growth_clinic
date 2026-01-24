"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-2xl border border-white/70 bg-white/60 px-4 text-sm text-[#1a1c24] shadow-sm placeholder:text-[#8a8f9b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-white/40",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
