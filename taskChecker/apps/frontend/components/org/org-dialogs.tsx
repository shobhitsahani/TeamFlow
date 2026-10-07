"use client";

/* Shared organization dialogs — single source of truth for creating and
   joining organizations. Used by Settings (Organizations section) and the
   sidebar workspace switcher so every entry point shares one validated flow.
   Quiet Harbor: sentence case, neutral surfaces, one primary per dialog. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "../store";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { Modal, useToast } from "../overlay";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Field, FieldDescription, FieldLabel } from "../ui/field";
import { lagoonAvatarTone } from "../lagoon/lagoon-utils";
import { IconCheck, IconKey, IconLink, IconPlus, IconRefresh } from "../icons";

export function OrgGlyph({ name, hue, size = 28 }: { name: string; hue: number; size?: number }) {
  void hue;
  return (
    <span
      aria-hidden
      className="st-ws-logo"
      style={{
        width: size,
        height: size,
        background: lagoonAvatarTone(name || "?"),
        color: "#fff",
        fontSize: size * 0.4,
      }}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CreateOrgDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createOrg, creatingOrg } = useTenant();
  const toast = useToast();
  const [name, setName] = useState("");

  const close = () => {
    if (creatingOrg) return;
    setName("");
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || creatingOrg) return;
    try {
      const created = await createOrg(trimmed);
      setName("");
      onClose();
      toast({
        title: "Organization created",
        msg: `${created?.name ?? trimmed} is ready — switched to the new workspace.`,
      });
    } catch (err) {
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New organization"
      sub="Create a new workspace. You'll become its owner and switch to it immediately."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={!name.trim() || creatingOrg} loading={creatingOrg}>
            <IconPlus size={14} /> Create organization
          </Button>
        </>
      }
    >
      <Field>
        <FieldLabel htmlFor="shared-new-org-name">Organization name</FieldLabel>
        <Input
          id="shared-new-org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc"
          autoFocus
          maxLength={80}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
        />
        <FieldDescription>2–80 characters. You can invite teammates after.</FieldDescription>
      </Field>
    </Modal>
  );
}

type InvitePreview = { email: string; orgName: string; role: string; expiresAt: string };

function inviteExpired(preview: InvitePreview | null): boolean {
  if (!preview) return false;
  return new Date(preview.expiresAt).getTime() < Date.now();
}

/** Split a pasted invite link or typed code into a lookup. Links win when a
 *  token is present; anything else is treated as the short shareable code. */
function parseInviteInput(raw: string): { kind: "token"; value: string } | { kind: "code"; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const token = (url.searchParams.get("token") ?? "").trim();
    if (token) return { kind: "token", value: token };
  } catch {
    // Not a URL — fall through to code handling.
  }
  const tokenMatch = trimmed.match(/[?&]token=([A-Za-z0-9_-]+)/);
  const tokenValue = tokenMatch?.[1];
  if (tokenValue) return { kind: "token", value: tokenValue };
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes(" ")) {
    return { kind: "token", value: trimmed };
  }
  return { kind: "code", value: trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "") };
}

export function JoinOrgDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [input, setInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [resolved, setResolved] = useState<{ kind: "token" | "code"; value: string } | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const close = () => {
    if (lookingUp) return;
    setInput("");
    setPreview(null);
    setResolved(null);
    setError("");
    onClose();
  };

  const handleLookup = async () => {
    const parsed = parseInviteInput(input);
    if (!parsed || lookingUp) return;
    if (parsed.kind === "code" && !parsed.value) {
      setError("Enter the invite code from your email.");
      return;
    }
    setLookingUp(true);
    setError("");
    setPreview(null);
    try {
      const res =
        parsed.kind === "token"
          ? await api.auth.previewInvite(parsed.value)
          : await api.auth.previewInviteByCode(parsed.value);
      setPreview(res.invite);
      setResolved(parsed);
    } catch (err) {
      setPreview(null);
      setResolved(null);
      setError(err instanceof Error ? err.message : "Invalid invitation.");
    } finally {
      setLookingUp(false);
    }
  };

  const handleContinue = () => {
    if (!resolved) return;
    close();
    if (resolved.kind === "token") {
      router.push(`/auth/accept-invite?token=${encodeURIComponent(resolved.value)}`);
    } else {
      // The join page resolves codes typed by hand.
      router.push("/auth/accept-invite");
      toast({ title: "Enter your code", msg: "Type the code on the join page to continue." });
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshUser();
      toast({ title: "Memberships refreshed", msg: "Your organization list is up to date." });
    } catch {
      toast({ title: "Refresh failed", msg: "Try again in a moment.", kind: "err" });
    } finally {
      setRefreshing(false);
    }
  };

  const expired = inviteExpired(preview);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join an organization"
      sub="Paste the invite link or type the short code from your invitation email."
      footer={
        preview && !expired ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleContinue}>
              <IconCheck size={14} /> Continue to join
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => void handleLookup()} disabled={!input.trim() || lookingUp} loading={lookingUp}>
              <IconKey size={14} /> Find invite
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <div
          className={expired ? "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px]" : "rounded-lg border bg-muted/50 px-3 py-2.5 text-[13px]"}
        >
          <p>
            <strong>{preview.email}</strong> — invited to <strong>{preview.orgName}</strong> as{" "}
            <strong className="capitalize">{preview.role}</strong>
          </p>
          <p className="mt-1 text-muted-foreground">
            {expired
              ? "This invite has expired — ask for a fresh one."
              : `Invite expires ${new Date(preview.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
          </p>
          {!expired ? (
            <p className="mt-2 text-muted-foreground">
              Continue to accept it. New members create an account; existing members are added to the workspace.
            </p>
          ) : null}
        </div>
      ) : (
        <Field>
          <FieldLabel htmlFor="shared-join-invite">Invite link or code</FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
              <IconLink size={16} />
            </span>
            <Input
              id="shared-join-invite"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError("");
              }}
              placeholder="Paste invite link or code"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLookup();
              }}
              className="pl-9 font-mono"
            />
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          ) : (
            <FieldDescription>Links look like …/auth/accept-invite?token=…. Codes are short and typable.</FieldDescription>
          )}
        </Field>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">Already accepted elsewhere?</p>
        <Button variant="secondary" size="sm" onClick={() => void handleRefresh()} disabled={refreshing} loading={refreshing}>
          <IconRefresh size={14} /> I&apos;ve accepted — refresh list
        </Button>
      </div>
    </Modal>
  );
}
