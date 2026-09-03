import { cn } from "@/lib/utils";
import type { Grade } from "@/lib/scoring/config";
import type { FlagStatus, TenxFeasibility } from "@/lib/scoring/config";

export function GradeBadge({ grade, className }: { grade: Grade; className?: string }) {
  const tone = {
    S: "bg-grade-s/15 text-grade-s",
    A: "bg-grade-a/15 text-grade-a",
    B: "bg-grade-b/15 text-grade-b",
    C: "bg-grade-c/15 text-grade-c",
    D: "bg-grade-d/15 text-grade-d",
    F: "bg-grade-d/20 text-grade-d",
  }[grade];
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 font-mono text-xs font-medium tracking-wide",
        tone,
        className,
      )}
    >
      {grade}
    </span>
  );
}

export function FlagBadge({ status }: { status: FlagStatus }) {
  const tone = {
    GREEN: "bg-flag-green/15 text-flag-green",
    YELLOW: "bg-flag-yellow/15 text-flag-yellow",
    RED: "bg-flag-red/15 text-flag-red",
  }[status];
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.6875rem] tracking-wide", tone)}>
      {status}
    </span>
  );
}

export function FeasibilityBadge({ value }: { value: TenxFeasibility }) {
  const tone = {
    HIGH: "bg-grade-a/15 text-grade-a",
    POSSIBLE: "bg-grade-b/15 text-grade-b",
    LOW: "bg-grade-c/15 text-grade-c",
    UNREALISTIC: "bg-grade-d/15 text-grade-d",
  }[value];
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.6875rem] tracking-wide", tone)}>
      {value}
    </span>
  );
}

export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full bg-elevated px-2 font-mono text-[0.6875rem] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
