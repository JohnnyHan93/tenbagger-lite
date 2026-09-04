import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { APP_KICKER, APP_NAME, APP_SHORT } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export function SignInScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-fg">
      <div className="w-full max-w-sm space-y-6 rounded-[var(--radius-lg)] bg-surface p-6 shadow-[var(--shadow-border)]">
        <div>
          <div className="masthead text-2xl leading-tight text-fg">{APP_SHORT}</div>
          <p className="mt-1 font-mono text-[0.625rem] tracking-widest text-sage uppercase">
            {APP_KICKER}
          </p>
          <h1 className="mt-5 text-xl font-medium tracking-tight">{APP_NAME}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            운영자 로그인 후에만 투자 데이터를 불러옵니다. 세 엔진 점수는 합치지 않으며 매수 신호가
            아닙니다.
          </p>
        </div>
        {authEnabled ? (
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
              >
                {p.label}로 계속
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <p className="font-mono text-[0.625rem] leading-relaxed text-subtle">
          Google 또는 X 계정으로 인증합니다. 세션이 없는 요청은 워크스페이스를 읽지 않습니다.
        </p>
      </div>
    </main>
  );
}
