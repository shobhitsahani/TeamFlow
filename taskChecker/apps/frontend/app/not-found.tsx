import type { Metadata } from "next";
import { Component as NotFoundView } from "@/components/ui/404-page-not-found";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "Sorry, the page you are looking for could not be found.",
};

/* Global 404 — Next.js renders this for any unmatched route. */
export default function NotFound() {
  return <NotFoundView />;
}
