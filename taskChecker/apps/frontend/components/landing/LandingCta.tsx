"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./landing.module.css";

export function LandingCta() {
  return (
    <section
      aria-labelledby="cta-heading"
      className={`${styles.sectionRoot} relative border-t border-white/[0.06] bg-black py-24 sm:py-32`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className={`${styles.reveal} relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a080d] px-6 py-14 sm:px-10 sm:py-16 lg:px-14`}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-32 size-[360px] rounded-full bg-[radial-gradient(circle,_rgba(198,147,253,0.12),_transparent_70%)]"
          />

          <div className="relative flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <h2 id="cta-heading" className={`${styles.displayHeading} text-white`}>
                Bring the work into one harbor.
              </h2>
              <p className={`${styles.lede} mt-5 max-w-xl text-pretty text-zinc-400`}>
                Open a board, bring your team in, and keep every project inside its own tenant
                boundary.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Link
                href="/app/board"
                className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-[0_12px_32px_-16px_rgba(255,255,255,0.4)] transition-colors duration-200 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c693fd]"
              >
                Open your board
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/auth/sign-in"
                className="inline-flex min-h-11 items-center rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-sm font-medium text-zinc-300 transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c693fd]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingCta;
