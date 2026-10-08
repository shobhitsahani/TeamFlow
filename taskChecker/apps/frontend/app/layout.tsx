import type { Metadata } from "next";
// Self-hosted variable fonts (Fontsource): Quiet Harbor voice only —
// Space Grotesk display + DM Sans body + JetBrains Mono data.
// Local woff2 files remove the network step entirely — the build is
// deterministic and the CSS vars below keep every consumer unchanged.
import "@fontsource-variable/jetbrains-mono/index.css";
import "@fontsource-variable/space-grotesk/index.css";
import "@fontsource-variable/dm-sans/index.css";
import "./globals.css";
import "./trello.css";
import "./theme.css";
import "./lagoon.css";
import "./impeccable-tokens.css";
// Opt-in whole-theme variants (impeccable generate): each is scoped under
// html[data-theme="…"], so importing is inert until the board options menu
// sets the attribute. Quiet Harbor incumbent untouched by default.
import "./themes/variant-a-drydock.css";
import "./themes/variant-b-chartroom.css";
import "./themes/variant-c-pier.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "TeamFlow",
  description:
    "TeamFlow board — projects, kanban, and members, isolated per organization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Dark-first: default to .dark pre-paint to avoid a light flash (matches ThemeProvider key). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tf.theme.v2");if(t!=="light"&&t!=="dark"){t="dark"}if(t==="dark"){document.documentElement.classList.add("dark")}document.documentElement.style.colorScheme=t}catch(e){}})();`,
          }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (Avast/AVG `bis_*`,
          password managers, etc.) inject attributes on <body> before React
          hydrates — ignore those to avoid hydration-mismatch noise. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}