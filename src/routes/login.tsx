import { Navigate, createFileRoute } from "@tanstack/react-router";
import { SignInScreen } from "@/components/sign-in-screen";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return null;
  if (user) return <Navigate to="/" />;
  return <SignInScreen />;
}
