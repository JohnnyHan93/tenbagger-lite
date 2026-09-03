import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  FolderInput,
  History,
  Radar,
  Search,
  Settings,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "레이더", icon: Radar },
  { to: "/analyze", label: "분석", icon: Search },
  { to: "/watchlist", label: "워치", icon: Star },
  { to: "/history", label: "이력", icon: History },
  { to: "/evidence", label: "증거", icon: Activity },
  { to: "/handoff", label: "마스터", icon: FolderInput },
  { to: "/settings", label: "설정", icon: Settings },
] as const;

function NavLink({
  to,
  label,
  icon: Icon,
  compact,
}: {
  to: string;
  label: string;
  icon: typeof Radar;
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] text-sm transition-colors duration-150",
        compact
          ? "h-12 min-w-12 flex-col justify-center gap-0.5 px-2"
          : "h-11 px-3",
        active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      <span className={cn(compact && "text-[0.625rem] tracking-wide")}>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <Link to="/" className="mb-8 px-3">
          <div className="masthead text-xl leading-tight text-fg">Tenbagger Lite</div>
          <div className="mt-1 font-mono text-[0.625rem] tracking-widest text-sage uppercase">
            Wildcard 5%
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>
        <p className="px-3 pt-4 font-mono text-[0.625rem] leading-relaxed text-subtle">
          점수는 매수 신호가 아니다. Deep Dive 가치만 측정한다.
        </p>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm md:hidden">
        <Link to="/">
          <div className="masthead text-lg leading-none">Tenbagger Lite</div>
          <div className="mt-0.5 font-mono text-[0.6rem] tracking-widest text-sage uppercase">
            Wildcard 5%
          </div>
        </Link>
        <Link
          to="/settings"
          className="flex size-11 items-center justify-center rounded-[var(--radius-md)] text-muted"
          aria-label="설정"
        >
          <Settings className="size-4" strokeWidth={1.75} />
        </Link>
      </header>

      <main className="pb-24 md:ml-56 md:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 md:hidden">
        {NAV.slice(0, 5).map((item) => (
          <NavLink key={item.to} {...item} compact />
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="mb-1 font-mono text-[0.6875rem] tracking-widest text-sage uppercase">
            {kicker}
          </p>
        ) : null}
        <h1 className="masthead text-3xl text-fg md:text-4xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function SafetyNote() {
  return (
    <p className="mt-10 max-w-2xl border-t border-border pt-4 text-xs leading-relaxed text-subtle">
      Tenbagger Lite Score는 자동 매수 신호가 아니다. Wildcard 후보로서 추가 Deep Dive할
      가치가 있는지를 측정한다. Final Verdict는 DEEP DIVE NOW / WATCH / WAIT FOR PROOF /
      PASS 만 사용한다.
    </p>
  );
}
