"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/store";
import { useTheme } from "@/components/theme-provider";
import { useToast, Modal } from "@/components/overlay";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { OrgGlyph } from "@/components/org/org-dialogs";
import { lagoonAvatarTone, lagoonInitials } from "@/components/lagoon/lagoon-utils";
import {
  IconUser,
  IconUsers,
  IconWebhook,
  IconFileText,
  IconSettings,
  IconCheck,
  IconCopy,
  IconLogout,
  IconBuilding,
  IconShield,
  IconBell,
  IconSliders,
  IconArrowLeft,
  IconStar,
  IconZap,
} from "@/components/icons";

interface SettingsSection {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ size?: number }>;
}

const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { href: "/app/settings/profile", title: "My Profile", description: "Personal details, display name, and preferences", icon: IconUser },
  { href: "/app/settings/members", title: "Members", description: "Manage team members and roles", icon: IconUsers },
  { href: "/app/settings/integrations", title: "Integrations", description: "Webhooks and API keys", icon: IconWebhook },
  { href: "/app/settings/audit", title: "Audit log", description: "Security and admin activity trail", icon: IconFileText },
] as const;

const AVATAR_COLOR_PALETTES = [
  { label: "Amber Ochre", value: "#a86a0b" },
  { label: "Violet Royal", value: "#7c3aed" },
  { label: "Emerald Green", value: "#1f7a4d" },
  { label: "Slate Industrial", value: "#5d6676" },
  { label: "Deep Purple", value: "#6d28d9" },
  { label: "Teal Lagoon", value: "#0f766e" },
  { label: "Rose Vibrant", value: "#e11d48" },
  { label: "Sky Oceanic", value: "#0284c7" },
];

const BOARD_VARIANTS = [
  { id: "", name: "Default Lagoon", desc: "Emerald accents & crisp slate cards" },
  { id: "drydock", name: "Drydock", desc: "Cool technical graphite & steel blue" },
  { id: "chartroom", name: "Chartroom", desc: "Deep oceanic navy & navigation teal" },
  { id: "pier", name: "Pier", desc: "Warm sunset glow & seaside amber" },
];

export default function UserProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, updateProfile, logout, memberships } = useAuth();
  const { org, orgs, setOrg } = useTenant();
  const { theme, setTheme } = useTheme();

  // Profile fields
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [syncedName, setSyncedName] = useState<string | undefined>(undefined);
  const [savingName, setSavingName] = useState(false);

  // Custom user meta stored locally
  const [customTone, setCustomTone] = useState<string>("");
  const [customInitials, setCustomInitials] = useState<string>("");
  const [bio, setBio] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  // Preference fields
  const [boardVariant, setBoardVariant] = useState<string>("");
  const [compactDensity, setCompactDensity] = useState(false);
  const [showCardKeys, setShowCardKeys] = useState(true);

  // Notification toggles
  const [emailAssign, setEmailAssign] = useState(true);
  const [emailMentions, setEmailMentions] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  // Security / sign out modal
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  // Sync loaded user name
  if (!nameTouched && (user?.name ?? "") !== (syncedName ?? "")) {
    setSyncedName(user?.name);
    setName(user?.name ?? "");
  }

  // Load persisted user preferences
  useEffect(() => {
    if (!user?.id) return;
    try {
      const savedTone = window.localStorage.getItem(`tf_user_tone_${user.id}`);
      if (savedTone) setCustomTone(savedTone);

      const savedInitials = window.localStorage.getItem(`tf_user_initials_${user.id}`);
      if (savedInitials) setCustomInitials(savedInitials);

      const savedBio = window.localStorage.getItem(`tf_user_bio_${user.id}`);
      if (savedBio) setBio(savedBio);

      const savedTitle = window.localStorage.getItem(`tf_user_title_${user.id}`);
      if (savedTitle) setJobTitle(savedTitle);

      const savedVariant = window.localStorage.getItem("tf.board.variant") ?? "";
      setBoardVariant(savedVariant);

      const savedDensity = window.localStorage.getItem(`tf_user_density_${user.id}`);
      if (savedDensity) setCompactDensity(savedDensity === "compact");

      const savedKeys = window.localStorage.getItem(`tf_user_keys_${user.id}`);
      if (savedKeys) setShowCardKeys(savedKeys !== "false");

      const savedNotifs = window.localStorage.getItem(`tf_user_notifs_${user.id}`);
      if (savedNotifs) {
        const parsed = JSON.parse(savedNotifs);
        if (parsed.emailAssign !== undefined) setEmailAssign(parsed.emailAssign);
        if (parsed.emailMentions !== undefined) setEmailMentions(parsed.emailMentions);
        if (parsed.soundAlerts !== undefined) setSoundAlerts(parsed.soundAlerts);
      }
    } catch {
      // localStorage unavailable in private mode
    }
  }, [user?.id]);

  const trimmedName = name.trim();
  const nameDirty = nameTouched && trimmedName !== (user?.name ?? "");
  const nameValid = trimmedName.length >= 2 && trimmedName.length <= 80;

  const handleSaveName = async () => {
    if (!nameDirty || !nameValid || savingName) return;
    setSavingName(true);
    try {
      await updateProfile(trimmedName);
      setNameTouched(false);
      toast({ title: "Name updated", msg: "Your new display name is active everywhere." });
    } catch (err) {
      toast({
        title: "Update failed",
        msg: err instanceof Error ? err.message : "Could not save display name.",
        kind: "err",
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleSavePreferences = () => {
    if (!user?.id) return;
    setSavingMeta(true);
    try {
      if (customTone) {
        window.localStorage.setItem(`tf_user_tone_${user.id}`, customTone);
      } else {
        window.localStorage.removeItem(`tf_user_tone_${user.id}`);
      }

      if (customInitials.trim()) {
        window.localStorage.setItem(`tf_user_initials_${user.id}`, customInitials.trim().toUpperCase().slice(0, 3));
      } else {
        window.localStorage.removeItem(`tf_user_initials_${user.id}`);
      }

      window.localStorage.setItem(`tf_user_bio_${user.id}`, bio.trim());
      window.localStorage.setItem(`tf_user_title_${user.id}`, jobTitle.trim());
      window.localStorage.setItem("tf.board.variant", boardVariant);
      window.localStorage.setItem(`tf_user_density_${user.id}`, compactDensity ? "compact" : "comfortable");
      window.localStorage.setItem(`tf_user_keys_${user.id}`, showCardKeys ? "true" : "false");

      const notifs = { emailAssign, emailMentions, soundAlerts };
      window.localStorage.setItem(`tf_user_notifs_${user.id}`, JSON.stringify(notifs));

      toast({ title: "Preferences saved", msg: "Your profile customizations have been stored." });
    } catch (err) {
      toast({ title: "Save failed", msg: err instanceof Error ? err.message : "Storage error.", kind: "err" });
    } finally {
      setSavingMeta(false);
    }
  };

  const handleCopyId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      toast({ title: "Copied!", msg: "Account ID copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", msg: user.id, kind: "err" });
    }
  };

  const handleSwitchOrg = async (id: string, orgName: string) => {
    if (id === org?.id || switchingOrgId) return;
    setSwitchingOrgId(id);
    try {
      await setOrg(id);
      toast({ title: `Switched to ${orgName}`, msg: "Workspace active." });
    } catch (err) {
      toast({ title: "Switch failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      toast({ title: "Signed out", msg: "Session closed successfully." });
      router.replace("/auth/sign-in");
    } catch {
      setSigningOut(false);
    }
  };

  const effectiveAvatarColor = customTone || (user ? lagoonAvatarTone(user.id) : "#a86a0b");
  const effectiveInitials = customInitials.trim()
    ? customInitials.trim().toUpperCase().slice(0, 3)
    : lagoonInitials(name || user?.name || "SS");

  return (
    <AppShell>
      <div className="page settings-page">
        {/* Header with back navigation and clear route context */}
        <header className="page-header">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/app/board"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconArrowLeft size={14} /> Back to Board
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-xs font-semibold text-primary">User Settings</span>
            </div>
            <h1 className="page-title">My Profile &amp; Account</h1>
            <p className="page-subtitle">
              Manage your personal info, display name, avatar appearance, and workspace preferences
            </p>
          </div>
          <div className="page-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/app/settings")}
              className="gap-1.5"
            >
              <IconBuilding size={14} /> Workspace Settings
            </Button>
            <Button
              size="sm"
              onClick={handleSavePreferences}
              loading={savingMeta}
              disabled={savingMeta}
              className="gap-1.5"
            >
              <IconCheck size={14} /> Save All Preferences
            </Button>
          </div>
        </header>

        <div className="settings-layout">
          {/* Settings Left Navigation Sidebar */}
          <nav className="settings-nav" aria-label="Settings navigation">
            <ul>
              {SETTINGS_SECTIONS.map((section) => {
                const isCurrent = section.href === "/app/settings/profile";
                return (
                  <li key={section.href}>
                    <Link
                      href={section.href}
                      className={`settings-nav-item ${isCurrent ? "bg-accent text-accent-foreground font-semibold" : ""}`}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      <section.icon size={16} />
                      <span>{section.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 pt-4 border-t border-border/60">
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Shortcuts
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                <li>
                  <Link
                    href="/app/board"
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    <IconStar size={14} /> View Kanban Board
                  </Link>
                </li>
                <li>
                  <Link
                    href="/app/work"
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    <IconZap size={14} /> Work &amp; Tasks
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          {/* Main Settings Content */}
          <div className="settings-content flex flex-col gap-6">
            {/* Card 1: Personal Profile & Avatar Customizer */}
            <section className="settings-card shadow-sm border border-border/80 rounded-xl p-6 bg-card text-card-foreground">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <IconUser size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Personal Profile</h2>
                    <p className="text-xs text-muted-foreground">
                      This information represents you across tasks, cards, comments, and mentions.
                    </p>
                  </div>
                </div>
                {nameDirty ? (
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                    Unsaved changes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
                    Up to date
                  </Badge>
                )}
              </div>

              {/* Live Avatar Preview & Tone Selector */}
              <div className="mt-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 p-4 rounded-xl bg-muted/30 border border-border/40">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <Avatar
                    className="size-20 shadow-md ring-4 ring-background"
                    style={{ background: effectiveAvatarColor }}
                  >
                    <AvatarFallback
                      style={{ background: "transparent", color: "#fff", fontSize: 24, fontWeight: 700 }}
                    >
                      {effectiveInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-medium text-muted-foreground">Live Avatar</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-foreground">Avatar Color Tone</span>
                    {customTone && (
                      <button
                        type="button"
                        onClick={() => setCustomTone("")}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {AVATAR_COLOR_PALETTES.map((color) => {
                      const isSelected = effectiveAvatarColor.toLowerCase() === color.value.toLowerCase();
                      return (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setCustomTone(color.value)}
                          title={color.label}
                          aria-label={color.label}
                          className={`size-7 rounded-full transition-transform flex items-center justify-center border-2 ${
                            isSelected ? "scale-110 border-white shadow-md ring-2 ring-primary" : "border-transparent opacity-80 hover:opacity-100"
                          }`}
                          style={{ background: color.value }}
                        >
                          {isSelected && <IconCheck size={14} className="text-white" />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="custom-initials" className="text-xs">
                        Custom Initials (Optional)
                      </FieldLabel>
                      <Input
                        id="custom-initials"
                        value={customInitials}
                        onChange={(e) => setCustomInitials(e.target.value.toUpperCase().slice(0, 3))}
                        placeholder={lagoonInitials(name || "SS")}
                        maxLength={3}
                        className="h-8 text-xs font-mono font-bold tracking-wider uppercase max-w-[120px]"
                      />
                      <FieldDescription className="text-[11px]">Override the auto-generated initials</FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="profile-job-title" className="text-xs">
                        Role / Job Title
                      </FieldLabel>
                      <Input
                        id="profile-job-title"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Lead Engineer, Product Designer"
                        maxLength={60}
                        className="h-8 text-xs"
                      />
                      <FieldDescription className="text-[11px]">Displayed on teammate cards</FieldDescription>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Display Name & Email Inputs */}
              <FieldGroup className="mt-6 space-y-4">
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="profile-display-name" className="text-sm font-semibold">
                      Display Name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {trimmedName.length} / 80
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="profile-display-name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setNameTouched(true);
                      }}
                      placeholder="Your full name"
                      autoComplete="name"
                      maxLength={80}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveName();
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleSaveName()}
                      disabled={!nameDirty || !nameValid || savingName}
                      loading={savingName}
                      className="gap-1.5 shrink-0"
                    >
                      <IconCheck size={14} /> Save Name
                    </Button>
                  </div>
                  <FieldDescription className="text-xs text-muted-foreground">
                    Must be 2–80 characters. Visible on your cards, comments, notifications, and topbar.
                  </FieldDescription>
                </Field>

                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="profile-email" className="text-sm font-semibold">
                      Email Address
                    </FieldLabel>
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                      Verified Identity
                    </Badge>
                  </div>
                  <Input
                    id="profile-email"
                    type="email"
                    value={user?.email ?? ""}
                    readOnly
                    disabled
                    className="font-mono text-xs opacity-75 mt-1"
                  />
                  <FieldDescription className="text-xs text-muted-foreground">
                    Email is your sign-in identity and is permanently tied to your credentials.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="profile-bio" className="text-sm font-semibold">
                    Bio / Status Message
                  </FieldLabel>
                  <Input
                    id="profile-bio"
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. Focusing on sprint goals · Available for code reviews"
                    maxLength={140}
                    className="mt-1 text-xs"
                  />
                  <FieldDescription className="text-xs text-muted-foreground">
                    Share a short status with your team (up to 140 characters).
                  </FieldDescription>
                </Field>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div>
                    <span className="block text-xs font-semibold text-foreground">User ID</span>
                    <span className="block font-mono text-[11px] text-muted-foreground truncate max-w-xs sm:max-w-md">
                      {user?.id ?? "—"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopyId()}
                    className="gap-1.5 text-xs h-7 px-2"
                  >
                    <IconCopy size={13} /> Copy ID
                  </Button>
                </div>
              </FieldGroup>
            </section>

            {/* Card 2: Appearance & Theme Settings */}
            <section className="settings-card shadow-sm border border-border/80 rounded-xl p-6 bg-card text-card-foreground">
              <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <IconSliders size={22} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Appearance &amp; Board Themes</h2>
                  <p className="text-xs text-muted-foreground">
                    Customize your visual environment, contrast, and board aesthetics.
                  </p>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="mt-5">
                <span className="block text-sm font-semibold mb-2">Color Mode</span>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      theme === "light"
                        ? "border-primary bg-primary/10 font-semibold ring-1 ring-primary"
                        : "border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-foreground">Light Theme</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">High clarity daylight</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      theme === "dark"
                        ? "border-primary bg-primary/10 font-semibold ring-1 ring-primary"
                        : "border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-foreground">Dark Theme</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">Deep slate &amp; low eye strain</span>
                  </button>
                </div>
              </div>

              {/* Board Variant Selector */}
              <div className="mt-6">
                <span className="block text-sm font-semibold mb-2">Lagoon Board Accent Variant</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BOARD_VARIANTS.map((v) => {
                    const isSelected = boardVariant === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setBoardVariant(v.id);
                          try {
                            window.localStorage.setItem("tf.board.variant", v.id);
                            toast({ title: `${v.name} selected`, msg: "Board style updated." });
                          } catch {
                            // ignore
                          }
                        }}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                          isSelected
                            ? "border-primary bg-primary/10 font-semibold ring-1 ring-primary"
                            : "border-border hover:bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <div
                          className="size-4 rounded-full mt-0.5 shrink-0 border"
                          style={{
                            background:
                              v.id === "drydock"
                                ? "#64748b"
                                : v.id === "chartroom"
                                  ? "#0284c7"
                                  : v.id === "pier"
                                    ? "#d97706"
                                    : "#10b981",
                          }}
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-foreground">{v.name}</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">{v.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout Density */}
              <div className="mt-6 pt-4 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="block text-sm font-semibold text-foreground">Compact Card Density</span>
                  <span className="block text-xs text-muted-foreground">
                    Display more tasks on screen with streamlined card padding.
                  </span>
                </div>
                <Button
                  variant={compactDensity ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCompactDensity((prev) => !prev)}
                >
                  {compactDensity ? "Compact Mode Enabled" : "Standard Density"}
                </Button>
              </div>
            </section>

            {/* Card 3: Notification & Communication Preferences */}
            <section className="settings-card shadow-sm border border-border/80 rounded-xl p-6 bg-card text-card-foreground">
              <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <IconBell size={22} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Notifications &amp; Alerts</h2>
                  <p className="text-xs text-muted-foreground">
                    Control what notifications you receive and how alerts sound.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors border border-border/30">
                  <div>
                    <span className="block text-sm font-medium text-foreground">Task Assignments</span>
                    <span className="block text-xs text-muted-foreground">
                      Get notified when you are assigned or unassigned from cards.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAssign}
                    onChange={(e) => setEmailAssign(e.target.checked)}
                    className="size-4 accent-primary rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors border border-border/30">
                  <div>
                    <span className="block text-sm font-medium text-foreground">Mentions &amp; Comments</span>
                    <span className="block text-xs text-muted-foreground">
                      Alerts when someone mentions @you in comments or discussions.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailMentions}
                    onChange={(e) => setEmailMentions(e.target.checked)}
                    className="size-4 accent-primary rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors border border-border/30">
                  <div>
                    <span className="block text-sm font-medium text-foreground">In-App Audio Chimes</span>
                    <span className="block text-xs text-muted-foreground">
                      Play subtle audio chime when new mentions or tasks arrive.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundAlerts}
                    onChange={(e) => setSoundAlerts(e.target.checked)}
                    className="size-4 accent-primary rounded cursor-pointer"
                  />
                </label>
              </div>
            </section>

            {/* Card 4: Workspaces & Memberships */}
            <section className="settings-card shadow-sm border border-border/80 rounded-xl p-6 bg-card text-card-foreground">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                    <IconBuilding size={22} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Your Workspaces</h2>
                    <p className="text-xs text-muted-foreground">
                      Organizations you belong to and your permissions.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/app/settings#organizations")}
                  className="gap-1 text-xs"
                >
                  Manage Orgs
                </Button>
              </div>

              <ul className="mt-4 flex flex-col gap-2">
                {orgs.map((o) => {
                  const isCurrent = o.id === org?.id;
                  const isSwitching = switchingOrgId === o.id;
                  return (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                    >
                      <OrgGlyph name={o.name} hue={o.hue} size={30} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{o.name}</span>
                        <span className="block truncate text-xs text-muted-foreground font-mono">
                          {o.slug}
                        </span>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {o.role}
                      </Badge>
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 px-2 py-1 bg-emerald-500/10 rounded-md">
                          <IconCheck size={14} /> Current
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isSwitching || switchingOrgId !== null}
                          loading={isSwitching}
                          onClick={() => void handleSwitchOrg(o.id, o.name)}
                          className="h-7 text-xs"
                        >
                          Switch
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Card 5: Security & Session */}
            <section className="settings-card shadow-sm border border-border/80 rounded-xl p-6 bg-card text-card-foreground">
              <div className="flex items-center gap-3 pb-4 border-b border-border/50">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                  <IconShield size={22} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Security &amp; Active Session</h2>
                  <p className="text-xs text-muted-foreground">
                    Session details and device authentication.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="block text-sm font-semibold text-foreground">
                    Active Session: {user?.email ?? "Signed In"}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Your session is active on this browser with a secure refresh token.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowSignOutModal(true)}
                  className="gap-1.5 shrink-0"
                >
                  <IconLogout size={14} /> Sign out of device
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      <Modal
        open={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Sign out of TeamFlow?"
        sub={`You will be logged out of your account (${user?.email ?? ""}) on this device.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSignOutModal(false)} disabled={signingOut}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              loading={signingOut}
              className="gap-1.5"
            >
              <IconLogout size={14} /> Confirm Sign Out
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your saved tasks, board updates, and preferences will remain intact. You will be redirected
          to the sign-in screen.
        </p>
      </Modal>
    </AppShell>
  );
}
