"use client";

import { InteractiveBoardPreview } from "@/components/landing/InteractiveBoardPreview";
import styles from "./landing.module.css";

const proofs = ["Postgres RLS", "Scoped RBAC", "Realtime replay", "Audit trail"];

export function LandingBoardSection() {
  return (
    <section
      id="product"
      tabIndex={-1}
      aria-labelledby="product-heading"
      className={`${styles.sectionRoot} relative scroll-mt-6 bg-black pb-24 focus:outline-none sm:pb-32`}
    >
      {/* Guarantee ticker: a quiet mono loop of the platform's own guarantee
          words. Decorative repetition, hidden from assistive technology. */}
      <div className={`${styles.ticker} select-none`} aria-hidden="true">
        <div className={styles.tickerTrack}>
          {proofs.map((proof) => (
            <span key={proof} className={styles.tickerItem}>
              {proof}
              <span aria-hidden="true" className={styles.tickerDot}>
                ·
              </span>
            </span>
          ))}
          {proofs.map((proof) => (
            <span key={`dup-${proof}`} className={`${styles.tickerItem} ${styles.tickerDup}`}>
              {proof}
              <span aria-hidden="true" className={styles.tickerDot}>
                ·
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <div className={styles.reveal}>
          <span aria-hidden="true" className={styles.sectionIndex}>
            01
          </span>
          <h2 id="product-heading" className={`${styles.displayHeading} mt-6 max-w-4xl text-white`}>
            One board, from first idea to done.
          </h2>

          <p className={`${styles.lede} mt-6 max-w-xl text-pretty text-zinc-400`}>
            Projects, teams, assignees, and due dates stay in one place. Every card move lands
            live for the rest of the room.
          </p>
        </div>
      </div>

      {/* The specimen: the board breaks out of the text column and anchors
          to the viewport edges, rising on its own scroll timeline. */}
      <div className="relative mt-16 sm:mt-24">
        {/* Ambient wash: a single restrained glow that grounds the frame,
            fading in on the same scroll timeline as the plate. */}
        <div
          aria-hidden="true"
          className={`${styles.revealGlow} pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,_rgba(147,51,234,0.14),_transparent_70%)]`}
        />
        <div className={styles.revealPlate}>
          <InteractiveBoardPreview />
        </div>
      </div>
    </section>
  );
}

export default LandingBoardSection;
