"use client";

/* E2E encrypted 1:1 chat dialog — thin modal wrapper around DmChatView.
 * The shared view hosts the crypto handshake, message list, and composer;
 * this file only provides the dialog chrome. The same view renders inline
 * in the Members page embedded Chats panel. */

import { Modal } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import { DmChatView, type DmPeer } from "@/components/dm-chat-view";

export type { DmPeer } from "@/components/dm-chat-view";

export function DmChatDialog({
  open,
  onClose,
  peer,
  currentUserId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  peer: DmPeer | null;
  currentUserId: string | undefined;
  /** Fired after a successful send — lets the host refresh its thread list. */
  onSent?: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Secure chat — ${peer?.peerName ?? peer?.peerEmail ?? "Member"}`}
      sub={peer?.peerEmail ?? undefined}
      contentClassName="dm-dialog"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <DmChatView peer={peer} currentUserId={currentUserId} onClose={onClose} onSent={onSent} />
    </Modal>
  );
}
