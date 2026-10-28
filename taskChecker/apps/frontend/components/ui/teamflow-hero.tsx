"use client";

import type React from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

/* ---------------- WordsPullUp ---------------- */
interface WordsPullUpProps {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  style?: React.CSSProperties;
}

export const WordsPullUp = ({ text, className = "", showAsterisk = false, style }: WordsPullUpProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const words = text.split(" ");

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`} style={style}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block relative"
            style={{ marginRight: isLast ? 0 : "0.25em" }}
          >
            {word}
            {showAsterisk && isLast && (
              <span className="absolute top-[0.65em] -right-[0.3em] text-[0.31em]">*</span>
            )}
          </motion.span>
        );
      })}
    </div>
  );
};

/* ---------------- WordsPullUpMultiStyle ---------------- */
interface Segment {
  text: string;
  className?: string;
}

interface WordsPullUpMultiStyleProps {
  segments: Segment[];
  className?: string;
  style?: React.CSSProperties;
}

export const WordsPullUpMultiStyle = ({ segments, className = "", style }: WordsPullUpMultiStyleProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const words: { word: string; className?: string }[] = [];
  segments.forEach((seg) => {
    seg.text.split(" ").forEach((w) => {
      if (w) words.push({ word: w, className: seg.className });
    });
  });

  return (
    <div ref={ref} className={`inline-flex flex-wrap justify-center ${className}`} style={style}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={`inline-block ${w.className ?? ""}`}
          style={{ marginRight: "0.25em" }}
        >
          {w.word}
        </motion.span>
      ))}
    </div>
  );
};

/* ---------------- TeamFlow Hero ---------------- */
const navItems = [
  { label: "Board", href: "/app/board" },
  { label: "Projects", href: "/app/projects" },
  { label: "Teams", href: "/app/teams" },
  { label: "Activity", href: "/app/activity" },
  { label: "Sign in", href: "/auth/sign-in" },
];

export const TeamFlowHero = () => {
  return (
    <section className="h-screen w-full">
      <div className="relative h-full w-full overflow-hidden rounded-2xl md:rounded-[2rem]">
        {/* Background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
        />

        {/* Noise overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.25] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

        {/* Navbar */}
        <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-b-2xl border-b border-x border-white/10 bg-black/90 px-4 py-2 sm:gap-6 md:gap-10 md:rounded-b-3xl md:px-8 lg:gap-12 backdrop-blur-md">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[10px] font-medium transition-colors sm:text-xs md:text-sm"
                style={{ color: "rgba(225, 224, 204, 0.8)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#E1E0CC")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(225, 224, 204, 0.8)")}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 sm:px-6 md:px-10 md:pb-6">
          <div className="grid grid-cols-12 items-end gap-4 lg:gap-8">
            <div className="col-span-12 lg:col-span-8">
              <h1
                className="select-none font-medium leading-[0.85] tracking-[-0.05em] text-[16vw] sm:text-[14.5vw] md:text-[13.5vw] lg:text-[12.5vw] xl:text-[12vw]"
                style={{ color: "#E1E0CC" }}
              >
                <WordsPullUp text="TeamFlow" showAsterisk />
              </h1>
            </div>

            <div className="col-span-12 flex flex-col gap-5 pb-4 lg:col-span-4 lg:pb-8">
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-xs sm:text-sm md:text-base font-normal"
                style={{ color: "rgba(225, 224, 204, 0.85)", lineHeight: 1.35 }}
              >
                The quiet harbor for high-velocity teams. Plan, assign, and track work across projects with hard tenant isolation and sub-second realtime sync.
              </motion.p>

              <div className="flex items-center gap-3">
                <Link href="/app/board">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="group inline-flex items-center gap-2 self-start rounded-full bg-[#E1E0CC] py-1 pl-5 pr-1 text-sm font-medium text-black transition-all hover:bg-white hover:gap-3 sm:text-base cursor-pointer shadow-lg shadow-black/40"
                  >
                    Open your board
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                      <ArrowRight className="h-4 w-4" style={{ color: "#E1E0CC" }} />
                    </span>
                  </motion.div>
                </Link>

                <Link href="/auth/sign-in">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex items-center rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs sm:text-sm font-medium text-[#E1E0CC] backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10 hover:text-white cursor-pointer"
                  >
                    Sign in
                  </motion.div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeamFlowHero;
