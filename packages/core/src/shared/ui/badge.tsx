import type { ReactNode } from "react";

const variants = {
  default: "bg-fd-secondary text-fd-secondary-foreground",
  new: "bg-fd-success/15 text-fd-success",
  beta: "bg-fd-info/15 text-fd-info",
  deprecated: "bg-fd-warning/15 text-fd-warning",
  danger: "bg-fd-error/15 text-fd-error",
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  variant = "default",
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 align-middle text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
