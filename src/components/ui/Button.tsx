import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "long" | "short" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white",
  long: "bg-long text-[#06281d]",
  short: "bg-short text-white",
  ghost: "bg-surface-2 text-muted border border-border",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
