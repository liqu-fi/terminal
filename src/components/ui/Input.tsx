import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-[var(--radius-sm)] border border-border bg-surface-2 px-2 py-1.5 text-sm text-text outline-none focus:border-accent ${className}`}
      {...props}
    />
  );
}
