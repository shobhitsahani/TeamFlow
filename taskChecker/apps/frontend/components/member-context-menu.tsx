"use client";

/* Right-click context menu for the members directory.
 * Native-feel floating menu: Message securely (E2E DM), View profile,
 * Copy email, Copy user ID, plus optional admin actions (change role handled
 * inline in the table; remove surfaced here for keyboard/mouse parity). */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  IconCopy,
  IconLock,
  IconMail,
  IconTrash,
  IconUser,
} from "@/components/icons";

export interface CtxMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
}

export function MemberContextMenu({
  member,
  x,
  y,
  isSelf,
  canManage,
  onClose,
  onMessage,
  onViewProfile,
  onCopyEmail,
  onCopyId,
  onRemove,
}: {
  member: CtxMember;
  x: number;
  y: number;
  isSelf: boolean;
  canManage: boolean;
  onClose: () => void;
  onMessage: () => void;
  onViewProfile: () => void;
  onCopyEmail: () => void;
  onCopyId: () => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape / scroll-away. Focus the menu for keyboard users.
  useEffect(() => {
    ref.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onScroll = () => onClose();
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Clamp into the viewport (menu ~240px wide, ~300px tall max).
  const left = Math.min(x, Math.max(8, window.innerWidth - 252));
  const top = Math.min(y, Math.max(8, window.innerHeight - 320));

  const label = member.name ?? member.email ?? "Member";

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${label}`}
      tabIndex={-1}
      className={cn("dir-ctx")}
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="dir-ctx-head" aria-hidden>
        <span className="dir-ctx-name">{label}</span>
        <span className="dir-ctx-sub font-mono">{member.email ?? member.role}</span>
      </div>
      {!isSelf ? (
        <button
          type="button"
          role="menuitem"
          className="dir-ctx-item is-primary"
          onClick={onMessage}
          autoFocus
        >
          <IconLock size={14} />
          <span>
            Message securely
            <small>End-to-end encrypted</small>
          </span>
        </button>
      ) : null}
      <button type="button" role="menuitem" className="dir-ctx-item" onClick={onViewProfile}>
        <IconUser size={14} /> View profile
      </button>
      <button
        type="button"
        role="menuitem"
        className="dir-ctx-item"
        onClick={onCopyEmail}
        disabled={!member.email}
      >
        <IconMail size={14} /> Copy email
      </button>
      <button type="button" role="menuitem" className="dir-ctx-item" onClick={onCopyId}>
        <IconCopy size={14} /> Copy user ID
      </button>
      {!isSelf && canManage && onRemove ? (
        <>
          <div className="dir-ctx-sep" aria-hidden />
          <button
            type="button"
            role="menuitem"
            className="dir-ctx-item is-danger"
            onClick={onRemove}
          >
            <IconTrash size={14} /> Remove from organization
          </button>
        </>
      ) : null}
    </div>
  );
}
