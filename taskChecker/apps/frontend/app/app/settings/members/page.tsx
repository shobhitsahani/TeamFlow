"use client";

import { useState, useMemo, memo, useEffect, useRef } from "react";
import { useTenant } from "@/components/store";
import { useRealtime } from "@/lib/realtime";
import { Modal, ConfirmDialog, useToast } from "@/components/overlay";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AppShell } from "@/components/app-shell";
import {
  IconPlus,
  IconSearch,
  IconUsers,
  IconMail,
  IconTrash,
  IconCopy,
  IconCheck,
  IconLink,
  IconKey,
  IconClock,
  IconMessageSquare,
} from "@/components/icons";
import { api, getCurrentTenantId, type Role } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSWR } from "@/lib/swr";
import { cx, hueFrom } from "@/lib/utils";
import { MemberContextMenu } from "@/components/member-context-menu";
import { DmChatDialog, type DmPeer } from "@/components/dm-chat-dialog";
import { PlusIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageEnter } from "@/components/motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  userId: string;
  name: string | null;
  email: string | null;
  role: Role;
  status: "invited" | "active" | "deactivated";
}

const ROLE_VALUES: Role[] = ["owner", "admin", "member", "viewer"];
const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};
const ROLE_HIERARCHY: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

/** Raw mailer errors are ops diagnostics (`supabase_404: …`) — translate the
 * known config failure into what the inviter should actually check. */
function friendlyEmailError(raw?: string): string {
  if (!raw) return "unknown mail error";
  if (raw.startsWith("supabase_404"))
    return "mail server 404 — backend SUPABASE_URL must be exactly https://<ref>.supabase.co (no /auth/v1 suffix), key from the same project";
  return raw;
}

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
  return src.slice(0, 2).toUpperCase();
}

const MemberRow = memo(function MemberRow({
  member,
  currentUserRole,
  currentUserId,
  onRoleChange,
  onDeactivate,
  onContextMenu,
  onMessage,
  onProfile,
}: {
  member: Member;
  currentUserRole: Role;
  currentUserId: string | undefined;
  onRoleChange: (userId: string, role: Role) => void;
  onDeactivate: (userId: string) => void;
  onContextMenu: (member: Member, x: number, y: number) => void;
  onMessage: (member: Member) => void;
  onProfile: (member: Member) => void;
}) {
  const isSelf = member.userId === currentUserId;
  const canManage = (ROLE_HIERARCHY[currentUserRole] ?? 0) > (ROLE_HIERARCHY[member.role] ?? 0);
  const canChangeRole = (targetRole: Role) =>
    (ROLE_HIERARCHY[currentUserRole] ?? 0) > (ROLE_HIERARCHY[targetRole] ?? 0);
  const tint = hueFrom(member.userId + (member.email ?? ""));
  const online = member.status === "active";
  const elevated = member.role === "owner" || member.role === "admin";

  const openActionsAt = (x: number, y: number) => {
    // Every click shows something: own row opens your profile (no DM to self),
    // other rows open the actions menu (Message securely first).
    if (isSelf) {
      onProfile(member);
      return;
    }
    onContextMenu(member, x, y);
  };

  return (
    <TableRow
      className="dir-row-hint cursor-pointer"
      title={isSelf ? "Click to view your profile" : "Click for actions (message, profile, more) — right-click works too"}
      tabIndex={0}
      aria-label={`Open actions for ${member.name ?? member.email ?? "member"} (message, profile)`}
      onContextMenu={(e) => {
        e.preventDefault();
        openActionsAt(e.clientX, e.clientY);
      }}
      onClick={(e) => {
        // Don't hijack clicks on inner controls (role select, message/delete buttons).
        const t = e.target as HTMLElement | null;
        if (t?.closest?.("button, select, [role='combobox'], [role='listbox'], input, a, [data-no-row-click]")) return;
        openActionsAt(e.clientX, e.clientY);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          // Keyboard parity for the click-to-DM menu (position near the row).
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          e.preventDefault();
          openActionsAt(r.left + 120, r.bottom + 4);
        }
      }}
    >
      <TableCell>
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar>
            <AvatarFallback
              style={{
                background: `hsl(${tint} 45% 20%)`,
                color: `hsl(${tint} 80% 78%)`,
              }}
            >
              {initials(member.name, member.email)}
            </AvatarFallback>
            {online ? <AvatarBadge className="bg-emerald-500" /> : null}
          </Avatar>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13 }}>
              {member.name ?? "Unknown"}
              {isSelf ? <Badge variant="secondary">You</Badge> : null}
            </span>
            <span className="dir-user-email font-mono">{member.email ?? "—"}</span>
          </span>
        </span>
      </TableCell>
      <TableCell>
        <span
          className={cx("dir-status", online ? "is-on" : member.status === "invited" ? "is-invited" : "is-off")}
          title={online ? "Online" : member.status === "invited" ? "Invited" : "Offline"}
        >
          <span className="dir-status-dot" />
          <span className="sr-only">{online ? "Online" : member.status === "invited" ? "Invited" : "Offline"}</span>
        </span>
      </TableCell>
      <TableCell>
        {canManage && !isSelf && member.status === "active" ? (
          <Select
            value={member.role}
            onValueChange={(v) => {
              if (v) onRoleChange(member.userId, v as Role);
            }}
          >
            <SelectTrigger size="sm" aria-label={`Role for ${member.email ?? member.name}`} className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_VALUES.filter((r) => canChangeRole(r) || r === member.role).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={elevated ? "default" : "secondary"}>{ROLE_LABELS[member.role]}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, justifyContent: "flex-end" }}>
        {!isSelf && member.status === "active" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onMessage(member)}
                  aria-label={`Message ${member.name ?? member.email} securely`}
                />
              }
            >
              <IconMessageSquare size={14} />
            </TooltipTrigger>
            <TooltipContent>Message securely (E2E encrypted)</TooltipContent>
          </Tooltip>
        ) : null}
        {!isSelf && member.status === "active" && canManage ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDeactivate(member.userId)}
                  aria-label={`Remove ${member.email ?? member.name}`}
                />
              }
            >
              <IconTrash size={14} />
            </TooltipTrigger>
            <TooltipContent>Remove from organization</TooltipContent>
          </Tooltip>
        ) : isSelf ? (
          <span className="dim dir-hint">Current user</span>
        ) : !isSelf && !canManage ? (
          <span className="dim dir-hint">No access</span>
        ) : null}
        </span>
      </TableCell>
    </TableRow>
  );
});

export default function MembersPage() {
  const { org } = useTenant();
  const { user } = useAuth();
  const toast = useToast();
  const orgId = getCurrentTenantId();
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviting, setInviting] = useState(false);
  // Last created invite — shown inline so the link + code can be copied/sent.
  // Links/codes live 24h (backend-enforced). The backend also emails the
  // invite via Supabase Auth when configured; otherwise the inviter relays manually.
  const [lastInvite, setLastInvite] = useState<{ email: string; role: Role; url: string; code: string; expiresAt: string; emailSent: boolean; emailError?: string } | null>(null);
  const [copiedWhat, setCopiedWhat] = useState<"link" | "code" | null>(null);
  // Right-click menu + E2E DM + profile preview state.
  const [ctx, setCtx] = useState<{ member: Member; x: number; y: number } | null>(null);
  const [dmPeer, setDmPeer] = useState<DmPeer | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [profile, setProfile] = useState<Member | null>(null);

  const membersQ = useSWR<{ members: Member[] }>(
    orgId ? `members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );
  const members = useMemo(() => membersQ.data?.members ?? [], [membersQ.data]);
  const currentUser = useMemo(
    () => members.find((m) => m.userId === user?.id),
    [members, user?.id]
  );
  const currentUserRole = currentUser?.role ?? "member";
  const currentUserId = currentUser?.userId;

  const activeCount = useMemo(() => members.filter((m) => m.status === "active").length, [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.status.toLowerCase().includes(q)
    );
  }, [members, search]);

  // ---- Realtime DM fan-out for this page ----
  // The open DmChatDialog already refetches its own conversation on `dm.message`.
  // This page-level listener covers the closed-dialog case: toast on new
  // incoming DMs so a member click → chat feels live even before opening.
  // Plaintext is never in the event (E2E ids only) — toast stays generic.
  const membersRef = useRef(members);
  useEffect(() => {
    membersRef.current = members;
  });
  const dmPeerRef = useRef(dmPeer);
  useEffect(() => {
    dmPeerRef.current = dmPeer;
  });
  const dmOpenRef = useRef(dmOpen);
  useEffect(() => {
    dmOpenRef.current = dmOpen;
  });
  const selfIdRef = useRef(currentUserId);
  useEffect(() => {
    selfIdRef.current = currentUserId;
  });
  useRealtime(
    useMemo(
      () => ({
        onDm: (msg: { type: string; meta?: unknown }) => {
          const meta = msg.meta as
            | { conversationId?: string; messageId?: string; senderId?: string; peerId?: string }
            | undefined;
          if (msg.type === "dm.message") {
            if (!meta?.conversationId) return;
            if (meta.senderId && meta.senderId === selfIdRef.current) return; // own echo — dialog already mutated
            // If the matching dialog is open it refetches itself — just nudge.
            if (dmOpenRef.current && dmPeerRef.current?.conversationId === meta.conversationId) return;
            const sender = membersRef.current.find((m) => m.userId === meta.senderId);
            const label = sender?.name ?? sender?.email ?? "Someone";
            toast({ title: "New secure message", msg: `${label} sent you an encrypted DM — click them to open it.` });
          } else if (msg.type === "dm.created") {
            if (meta?.peerId && meta.peerId !== selfIdRef.current) {
              const peer = membersRef.current.find((m) => m.userId === meta.peerId);
              if (peer) toast({ title: "New secure chat", msg: `${peer.name ?? peer.email ?? "A member"} started a DM with you.` });
            }
          }
        },
      }),
      [toast],
    ),
  );

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !orgId || inviting) return;
    setInviting(true);
    try {
      const res = await api.orgs.invite(orgId, { email, role: inviteRole });
      setLastInvite({ email: res.invite.email, role: res.invite.role, url: res.invitationUrl, code: res.code, expiresAt: res.invite.expiresAt, emailSent: res.email.sent, emailError: res.email.sent ? undefined : res.email.error });
      setCopiedWhat(null);
      setInviteEmail("");
      await membersQ.mutate();
      toast({
        title: res.refreshed ? "Invite refreshed" : res.email.sent ? "Invite emailed" : "Invite ready",
        msg: res.email.sent
          ? `${email} got the ${res.refreshed ? "new " : ""}join link + code by email (expires in 24 hours).${res.refreshed ? " The previous link no longer works." : ""}`
          : res.email.error && res.email.error !== "email_unconfigured"
            ? `Email send failed (${friendlyEmailError(res.email.error)}) — share the ${res.refreshed ? "new " : ""}link or code with ${email} yourself (expires in 24 hours).`
            : `Email isn't configured (Supabase Auth) — send the ${res.refreshed ? "new " : ""}link or code to ${email} yourself (expires in 24 hours).`,
      });
    } catch (err) {
      toast({ title: "Invite failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setInviting(false);
    }
  };

  const openInviteModal = () => {
    setLastInvite(null);
    setCopiedWhat(null);
    setShowInviteModal(true);
  };

  const handleCopy = async (what: "link" | "code") => {
    if (!lastInvite) return;
    try {
      await navigator.clipboard.writeText(what === "link" ? lastInvite.url : lastInvite.code);
      setCopiedWhat(what);
      toast({ title: "Copied", msg: what === "link" ? "Invite link copied to clipboard." : "Invite code copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", msg: "Select the text and copy it manually." });
    }
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    if (!orgId) return;
    try {
      await api.orgs.updateMemberRole(orgId, userId, role);
      await membersQ.mutate();
      toast({ title: "Role updated", msg: "Member role changed" });
    } catch (err) {
      toast({ title: "Update failed", msg: err instanceof Error ? err.message : "Try again." });
      await membersQ.mutate();
    }
  };

  const handleDeactivate = (userId: string) => {
    if (!orgId) return;
    setDeactivateId(userId);
  };

  const confirmDeactivate = async () => {
    if (!orgId || !deactivateId) return;
    setDeactivating(true);
    try {
      await api.orgs.deactivateMember(orgId, deactivateId);
      setDeactivateId(null);
      await membersQ.mutate();
      toast({ title: "Member removed", msg: "They can be re-invited later" });
    } catch (err) {
      toast({ title: "Remove failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setDeactivating(false);
    }
  };

  // Context menu handlers
  const openContextMenu = (member: Member, x: number, y: number) => {
    setCtx({ member, x, y });
  };

  const closeContextMenu = () => setCtx(null);

  const handleMessage = async (member: Member) => {
    closeContextMenu();
    setProfile(null);
    if (member.userId === currentUserId) return;
    if (!orgId) return;
    try {
      const res = await api.dm.openConversation(member.userId);
      setDmPeer({
        conversationId: res.conversation.id,
        peerId: res.conversation.peerId,
        peerName: res.conversation.peerName,
        peerEmail: res.conversation.peerEmail,
      });
      setDmOpen(true);
    } catch (err) {
      toast({ title: "Couldn't open chat", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleViewProfile = (member: Member) => {
    closeContextMenu();
    setProfile(member);
  };

  const handleCopyEmail = (member: Member) => {
    closeContextMenu();
    if (member.email) {
      navigator.clipboard.writeText(member.email);
      toast({ title: "Copied", msg: "Email copied to clipboard." });
    }
  };

  const handleCopyId = (member: Member) => {
    closeContextMenu();
    navigator.clipboard.writeText(member.userId);
    toast({ title: "Copied", msg: "User ID copied to clipboard." });
  };

  const handleRemove = (member: Member) => {
    closeContextMenu();
    handleDeactivate(member.userId);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Synchronous controlled update: the input value must always equal the
    // latest keystroke. A deferred (transition) update can desync the visible
    // text from state under rapid typing and poison the filter query.
    setSearch(e.target.value);
  };

  return (
    <AppShell>
      <div className="page">
        <div className="dir-card">
          {/* Header — Stitch "Tenant Members & Team Directory" */}
          <div className="dir-head">
            <div className="dir-head-left">
              <div className="dir-head-icon">
                <IconUsers size={20} />
              </div>
              <div>
                <div className="dir-title-row">
                  <h1 className="dir-title">Members</h1>
                  <span className="dir-badge-total tabular-nums">{members.length} Total</span>
                  <span className="dir-badge-active tabular-nums">
                    <span className="dir-pulse" />
                    {activeCount} active now
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Toolbar — search + invite */}
          <div className="dir-toolbar">
            <div className="dir-search">
              <IconSearch size={15} />
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search members by name, role or email..."
                aria-label="Search members"
              />
            </div>
            <Button size="sm" className="dir-invite" onClick={openInviteModal}>
              <PlusIcon size={14} /> Invite Member
            </Button>
          </div>

          {/* Directory table */}
          <div className="dir-table-wrap">
            {membersQ.isLoading ? (
              <Table aria-hidden>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[0, 1, 2, 3].map((i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Skeleton className="size-8 shrink-0 rounded-full" />
                          <span style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <Skeleton className="h-3.5 w-32 rounded" />
                            <Skeleton className="h-3 w-44 rounded" />
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-7 w-20 rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : filteredMembers.length === 0 ? (
              <PageEnter className="empty-state">
                <IconUsers size={32} className="dim" />
                <p>{search ? "No matching members" : "No members yet"}</p>
                {search ? null : (
                  <Button size="sm" onClick={openInviteModal}>
                    <PlusIcon size={14} /> Invite Member
                  </Button>
                )}
              </PageEnter>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <MemberRow
                      key={member.userId}
                      member={member}
                      currentUserRole={currentUserRole}
                      currentUserId={currentUserId}
                      onRoleChange={handleRoleChange}
                      onDeactivate={handleDeactivate}
                      onContextMenu={openContextMenu}
                      onMessage={handleMessage}
                      onProfile={handleViewProfile}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer — counts */}
          <div className="dir-foot">
            <span>
              Showing {filteredMembers.length} {search ? "matching" : "active"} • {members.length} tenant
              member{members.length === 1 ? "" : "s"}
            </span>
            <span className="dim mono dir-foot-org">{org?.name ?? ""}</span>
          </div>
        </div>

        <Modal
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Invite member"
          sub={`They join ${org?.name ?? "the workspace"} as ${inviteRole}.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowInviteModal(false)}>
                {lastInvite ? "Done" : "Cancel"}
              </Button>
              {lastInvite ? (
                <Button variant="secondary" onClick={() => { setLastInvite(null); setCopiedWhat(null); }}>
                  <IconPlus size={14} /> Invite another
                </Button>
              ) : (
                <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} loading={inviting}>
                  <IconMail size={14} /> Create invite link
                </Button>
              )}
            </>
          }
        >
          <FieldGroup>
                {lastInvite ? (
                  <>
                    <div className="invite-success">
                      <span className="invite-success-icon">
                        <IconCheck size={16} />
                      </span>
                      <p>
                        Invite ready for <strong>{lastInvite.email}</strong> ({lastInvite.role}).
                        {lastInvite.emailSent
                          ? " They were emailed the link + code."
                          : lastInvite.emailError && lastInvite.emailError !== "email_unconfigured"
                            ? ` Email send failed (${friendlyEmailError(lastInvite.emailError)}) — share it yourself.`
                            : " Email isn't configured (Supabase Auth), so share it yourself."}
                      </p>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="invite-link">Share this link — direct invite</FieldLabel>
                      <div className="input-with-icon invite-link-row">
                        <IconLink size={16} />
                        <Input id="invite-link" type="text" value={lastInvite.url} readOnly onFocus={(e) => e.target.select()} aria-label="Invite link" />
                        <Button variant="secondary" size="sm" onClick={() => void handleCopy("link")} aria-label="Copy invite link">
                          {copiedWhat === "link" ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          {copiedWhat === "link" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="invite-code">Or share this code — they type it on the join page</FieldLabel>
                      <div className="input-with-icon invite-link-row">
                        <IconKey size={16} />
                        <Input id="invite-code" type="text" value={lastInvite.code} readOnly onFocus={(e) => e.target.select()} aria-label="Invite code" className="font-mono tracking-[0.2em]" />
                        <Button variant="secondary" size="sm" onClick={() => void handleCopy("code")} aria-label="Copy invite code">
                          {copiedWhat === "code" ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          {copiedWhat === "code" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <FieldDescription>
                        <IconClock size={12} /> Expires{" "}
                        {new Date(lastInvite.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}{" "}
                        (24 hours). Send it however you like — chat, SMS, or your own email.
                      </FieldDescription>
                    </Field>
                  </>
                ) : (
                  <>
                <Field>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <div className="input-with-icon">
                    <IconMail size={16} />
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleInvite();
                      }}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as Role)}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_VALUES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                  </>
                )}
          </FieldGroup>
        </Modal>
        <ConfirmDialog
          open={deactivateId !== null}
          onClose={() => (deactivating ? null : setDeactivateId(null))}
          title="Remove member?"
          body="They will lose access to the organization immediately and can be re-invited later."
          confirmLabel="Remove member"
          danger
          busy={deactivating}
          onConfirm={confirmDeactivate}
        />
        {ctx && (
          <MemberContextMenu
            member={ctx.member}
            x={ctx.x}
            y={ctx.y}
            isSelf={ctx.member.userId === currentUserId}
            canManage={(ROLE_HIERARCHY[currentUserRole] ?? 0) > (ROLE_HIERARCHY[ctx.member.role] ?? 0)}
            onClose={closeContextMenu}
            onMessage={() => handleMessage(ctx.member)}
            onViewProfile={() => handleViewProfile(ctx.member)}
            onCopyEmail={() => handleCopyEmail(ctx.member)}
            onCopyId={() => handleCopyId(ctx.member)}
            onRemove={() => handleRemove(ctx.member)}
          />
        )}
        {dmPeer && (
          <DmChatDialog
            open={dmOpen}
            onClose={() => setDmOpen(false)}
            peer={dmPeer}
            currentUserId={currentUserId}
          />
        )}
        {profile && (
          <Modal
            open={!!profile}
            onClose={() => setProfile(null)}
            title={profile.name ?? "Profile"}
            sub={profile.email ?? undefined}
            footer={
              <>
                <Button variant="ghost" onClick={() => setProfile(null)}>
                  Close
                </Button>
                {profile.userId !== currentUserId && profile.status === "active" ? (
                  <Button
                    onClick={() => void handleMessage(profile)}
                    aria-label={`Message ${profile.name ?? profile.email} securely`}
                  >
                    <IconMessageSquare size={14} /> Message securely
                  </Button>
                ) : null}
              </>
            }
          >
            <div className="dm-profile-row">
              <Avatar size="lg">
                <AvatarFallback
                  style={{
                    background: `hsl(${hueFrom(profile.userId + (profile.email ?? ""))} 45% 20%)`,
                    color: `hsl(${hueFrom(profile.userId + (profile.email ?? ""))} 80% 78%)`,
                  }}
                >
                  {initials(profile.name, profile.email)}
                </AvatarFallback>
              </Avatar>
              <div className="dm-profile-meta">
                <div>
                  <strong>{profile.name ?? "—"}</strong>
                  <span className="font-mono">{profile.userId}</span>
                </div>
                <div>{profile.email ?? "—"}</div>
                <div>Role: {ROLE_LABELS[profile.role]}</div>
                <div>Status: {profile.status}</div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
