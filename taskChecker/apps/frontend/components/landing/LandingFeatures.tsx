"use client";

import { FileText, LayoutGrid, Users, Zap } from "lucide-react";
import styles from "./landing.module.css";

const features = [
  {
    icon: Zap,
    title: "Updates that land",
    description:
      "Card moves, comments, and priority changes arrive without a refresh. If a client drops, a cursor-based replay stream picks up where it left off.",
    detail: "Realtime · replay cursor",
  },
  {
    icon: Users,
    title: "Permissions that hold",
    description:
      "Owner, admin, member, and viewer roles are checked on every mutating and admin surface, not just hidden in the interface.",
    detail: "Owner · admin · member · viewer",
  },
  {
    icon: LayoutGrid,
    title: "The whole job, attached",
    description:
      "Tasks carry owners, priorities, due dates, comments, and activity, so the board stays the source of truth instead of another tab.",
    detail: "Projects · tasks · activity",
  },
  {
    icon: FileText,
    title: "A record you can audit",
    description:
      "Every mutation records the actor, action, tenant, and time. Usage and audit views show what changed, and by whom.",
    detail: "Audit ledger · usage metering",
  },
];

export function LandingFeatures() {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className={`${styles.sectionRoot} relative border-t border-white/[0.06] bg-black py-24 sm:py-32`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className={`${styles.reveal} grid gap-6 lg:grid-cols-12 lg:items-end`}>
          <h2
            id="capabilities-heading"
            className={`${styles.displayHeading} text-white lg:col-span-7`}
          >
            Everything the room needs to keep moving.
          </h2>

          <p className={`${styles.lede} max-w-xl text-pretty text-zinc-400 lg:col-span-5 lg:justify-self-end`}>
            The details that usually live in five tabs stay attached to the work: people, dates,
            comments, activity, and the permissions around them.
          </p>
        </div>

        {/* Open editorial grid: hairline rules carry the structure instead of
            another set of bordered boxes. */}
        <div className="mt-14 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:gap-x-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className={`${styles.reveal} border-t border-white/[0.07] pt-8 sm:pt-10`}
                data-reveal={index % 2 === 1 ? "1" : undefined}
              >
                <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[#c693fd]">
                  <Icon className="size-4.5" aria-hidden="true" />
                </div>

                <h3 className={`${styles.cardTitle} mt-6 text-white`}>{feature.title}</h3>
                <p className="mt-3 max-w-md text-pretty text-[15px] leading-7 text-zinc-400">
                  {feature.description}
                </p>

                <p className={`${styles.monoData} mt-6 text-zinc-500`}>{feature.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default LandingFeatures;
