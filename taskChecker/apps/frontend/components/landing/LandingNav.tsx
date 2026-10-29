"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutDashboard, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiquidNavbar } from "@/components/ui/liquid-glass-navbar";

export function LandingNav() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#080c14]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-950/40 p-1.5 shadow-sm">
            <Image
              src="/logo_mark.png"
              alt="TeamFlow"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-lg font-bold tracking-tight text-white"
              style={{ fontFamily: "var(--font-joy-display)" }}
            >
              TeamFlow
            </span>
            <span className="hidden rounded-full border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-xs font-medium tracking-wide text-purple-300 sm:inline-block">
              B2B Ops
            </span>
          </div>
        </div>

        {/* Section Navigation Links */}
        <div className="hidden md:block">
          <LiquidNavbar
            tone="dark"
            items={[
              { label: "Interactive Board", href: "#board-preview", icon: <LayoutDashboard className="size-4" />, fx: "glow" },
              { label: "Tenant Isolation", href: "#tenant-security", icon: <Shield className="size-4" />, fx: "spin" },
              { label: "Capabilities", href: "#capabilities", icon: <Zap className="size-4" />, fx: "wave" },
            ]}
          />
        </div>

        {/* CTA Group */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
            onClick={() => router.push("/auth/sign-in")}
          >
            Sign in
          </Button>

          <Button
            size="sm"
            className="gap-1.5 rounded-lg bg-[oklch(0.65_0.24_300)] px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
            onClick={() => router.push("/app/board")}
          >
            Open board
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
