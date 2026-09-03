import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/analyze")({
  beforeLoad: () => {
    throw redirect({ to: "/discover" });
  },
  component: () => null,
});
