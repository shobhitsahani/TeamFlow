import type { Metadata } from "next";
// Self-hosted variable fonts (Fontsource): the same five Google typefaces
// next/font/google used to fetch at build time. next/font's Turbopack
// pipeline shells out to fonts.googleapis.com during `next build`, which
// fails in offline/sandboxed builders with
// "Can't resolve '@vercel/turbopack-next/internal/font/google/font'".
// Local woff2 files remove the network step entirely — the build is
// deterministic and the CSS vars below keep every consumer unchanged.
import "@fontsource-variable/inter/index.css";
import "@fontsource-variable/hanken-grotesk/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "@fontsource-variable/sora/index.css";
import "@fontsource-variable/manrope/index.css";
import "./tokens.css";
import "./globals.css";
import "./trello.css";
import "./theme.css";
import "./lagoon.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "TeamFlow",
  description:
    "TeamFlow board — projects, kanban, members and live team chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set .dark pre-paint to avoid a light flash (matches ThemeProvider key). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tf.theme.v1");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark"){document.documentElement.classList.add("dark")}document.documentElement.style.colorScheme=t}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}