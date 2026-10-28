"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./landing.module.css";

const productLinks = [
  { label: "Board", href: "/app/board" },
  { label: "Projects", href: "/app/projects" },
  { label: "Teams", href: "/app/teams" },
];

const accountLinks = [
  { label: "Sign in", href: "/auth/sign-in" },
  { label: "Sign up", href: "/auth/sign-up" },
];

const pageLinks = [
  { label: "Board preview", href: "#board-preview" },
  { label: "Tenant isolation", href: "#tenant-security" },
  { label: "Capabilities", href: "#capabilities" },
];

const proofs = ["Postgres RLS", "Scoped RBAC", "Realtime replay", "Audit trail"];

export function LandingFooter() {
  const linkClassName =
    "inline-flex min-h-9 items-center text-sm text-zinc-400 transition-colors duration-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c693fd]";

  return (
    <footer className="border-t border-white/[0.06] bg-black py-16 text-sm text-zinc-400">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-md">
              <span className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 p-1.5">
                <Image
                  src="/logo_mark.png"
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </span>
              <span className="font-bold tracking-tight text-white">TeamFlow</span>
            </Link>

            <p className="mt-5 max-w-xs text-pretty text-sm leading-6 text-zinc-400">
              The quiet harbor for high-velocity teams. Plan, assign, and track work without
              crossing another organization&apos;s boundary.
            </p>
            <p className="mt-4 font-mono text-xs text-zinc-500">
              Hard tenant isolation by construction.
            </p>
          </div>

          <nav aria-label="Product">
            <h2 className={styles.footerHeading}>Product</h2>
            <ul className="mt-4 space-y-1">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className={styles.footerHeading}>Account</h2>
            <ul className="mt-4 space-y-1">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="On this page">
            <h2 className={styles.footerHeading}>On this page</h2>
            <ul className="mt-4 space-y-1">
              {pageLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className={linkClassName}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-5 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} TeamFlow. Tenant isolation is an invariant.
          </p>

          <ul
            className={`${styles.proofRow} flex flex-wrap items-baseline gap-y-1`}
            aria-label="Platform guarantees"
          >
            {proofs.map((proof) => (
              <li key={proof} className={`${styles.monoData} text-zinc-500`}>
                {proof}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
