import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-md)] bg-inset px-3 text-base text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-border-hover)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-[var(--radius-md)] bg-inset px-3 py-2 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-border-hover)]",
        className,
      )}
      {...props}
    />
  );
}

export function NativeSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-[var(--radius-md)] bg-inset px-3 text-sm text-fg shadow-[var(--shadow-border)]",
        className,
      )}
      {...props}
    />
  );
}
