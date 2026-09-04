import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { displayTicker } from "@/lib/format";
import { cn } from "@/lib/utils";

export const FREEZE_COL = "idt-freeze idt-pane w-28 min-w-28 max-w-28 px-2 py-2 align-middle";
export const FREEZE_RANK = "idt-freeze w-7 min-w-7 max-w-7 px-1.5 py-2 text-center align-middle";
export const FREEZE_NAME_AFTER_RANK =
  "idt-freeze idt-freeze-rank idt-pane w-28 min-w-28 max-w-28 px-2 py-2 align-middle";

export function CompanyTicker({
  ticker,
  name,
  linked = true,
}: {
  ticker: string;
  name: string;
  linked?: boolean;
}) {
  const inner = (
    <>
      <span className="block truncate text-xs leading-tight text-fg">{name || displayTicker(ticker)}</span>
      <span className="mt-0.5 block truncate font-mono text-[0.625rem] leading-tight tracking-wide text-sage">
        {displayTicker(ticker)}
      </span>
    </>
  );
  if (!linked) {
    return <span className="block min-w-0">{inner}</span>;
  }
  return (
    <Link
      to="/company/$ticker"
      params={{ ticker: encodeURIComponent(ticker) }}
      className="block min-w-0"
    >
      {inner}
    </Link>
  );
}

export function FreezeHead({
  children = "종목",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={cn(FREEZE_COL, className)}>{children}</th>;
}

export function FreezeCell({
  ticker,
  name,
  className,
  linked = true,
}: {
  ticker: string;
  name: string;
  className?: string;
  linked?: boolean;
}) {
  return (
    <td className={cn(FREEZE_COL, className)}>
      <CompanyTicker ticker={ticker} name={name} linked={linked} />
    </td>
  );
}
