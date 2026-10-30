"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export interface ChatLightboxProps {
  item: { url: string; name: string; mime: string } | null;
  onClose: () => void;
}

export function ChatLightbox({ item, onClose }: ChatLightboxProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (item) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative max-h-[85vh] max-w-[90vw] flex flex-col items-center"
        >
          {item.mime.startsWith("image/") ? (
            <motion.img
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              src={item.url}
              alt={item.name}
              className="max-h-[80vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
            />
          ) : null}

          {/* Bottom info bar */}
          <div className="mt-3 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white">
            <span className="text-xs font-medium truncate max-w-xs">{item.name}</span>
            <a
              href={item.url}
              download={item.name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors"
            >
              <Download className="size-3.5" />
              <span>Download</span>
            </a>
          </div>
        </div>

        {/* Top close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 rounded-full size-10"
          aria-label="Close image preview"
        >
          <X className="size-5" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
