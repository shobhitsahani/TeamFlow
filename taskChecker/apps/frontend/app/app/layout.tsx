"use client";

import React, { type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import "../app-redesign.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="tf-app-scope tf-ambient-canvas min-h-screen w-full flex flex-col text-slate-100">
        {children}
      </div>
    </MotionConfig>
  );
}
