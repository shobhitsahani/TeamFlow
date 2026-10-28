"use client";

import { AppShell } from "@/components/app-shell";

export default function UsagePage() {
  return (
    <AppShell>
      <div className="page settings-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Usage</h1>
            <p className="page-subtitle">Usage tracking is currently disabled.</p>
          </div>
        </header>
        <div className="settings-content">
          <section className="settings-section">
            <h2>Current usage</h2>
            <p style={{ color: "var(--slate-500)" }}>Usage tracking is currently disabled.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}