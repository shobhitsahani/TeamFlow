"use client";

import React, { useEffect, type ReactNode } from "react";
import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import "../app-redesign.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Flag the document root while inside /app/* so portalled elements (modals, sheets, menus)
    // inherit glassmorphic tokens without bleeding into /, /auth/sign-in, or /auth/sign-up.
    document.documentElement.classList.add("tf-in-app");
    return () => {
      document.documentElement.classList.remove("tf-in-app");
    };
  }, []);

  return (
    <LazyMotion features={domAnimation} strict={false}>
      <MotionConfig reducedMotion="user">
        <div className="tf-app-scope tf-ambient-canvas min-h-screen w-full flex flex-col text-[var(--tf-fg)]">
          {children}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
