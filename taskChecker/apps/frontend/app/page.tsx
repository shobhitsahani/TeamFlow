"use client";

import { useRouter } from "next/navigation";
import LiquidMetalHero from "@/components/ui/liquid-metal-hero";
import { Button } from "@/components/ui/button";

export default function Page() {
  const router = useRouter();

  return (
    <main className="min-h-screen">
      {/* Minimal marketing nav — keeps /app/board one click away. */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <span className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
            >
              T
            </span>
            TeamFlow
          </span>
          <nav className="flex items-center gap-2" aria-label="Primary">
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground hover:bg-foreground/10"
              onClick={() => router.push("/auth/sign-in")}
            >
              Sign in
            </Button>
            <Button size="sm" onClick={() => router.push("/app/board")}>
              Open board
            </Button>
          </nav>
        </div>
      </header>

      <LiquidMetalHero
        badge="TeamFlow boards"
        title="Where your team's work lands"
        subtitle="Plan, assign, and track work across teams and projects — boards, tasks, and live updates, isolated per organization."
        primaryCtaLabel="Open your board"
        secondaryCtaLabel="Sign in"
        onPrimaryCtaClick={() => router.push("/app/board")}
        onSecondaryCtaClick={() => router.push("/auth/sign-in")}
        features={[
          "Kanban boards with priorities",
          "Assignees, due dates, activity",
          "Live updates in seconds",
        ]}
      />
    </main>
  );
}
