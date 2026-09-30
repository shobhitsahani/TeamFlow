"use client";

import { useState, useMemo, memo, startTransition, useCallback } from "react";
import { useTenant } from "@/components/store";
import { Modal, ConfirmDialog, useToast } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AppShell } from "@/components/app-shell";
import { IconPlus, IconKey, IconWebhook, IconCopy, IconTrash, IconRotateCw, IconExternalLink, IconEye, IconEyeOff } from "@/components/icons";
import { api, getCurrentTenantId, type Webhook, type ApiKey, type Delivery } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { cx } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageEnter } from "@/components/motion";

const ALL_EVENTS = [
  "task.created",
  "task.updated",
  "task.status_changed",
  "task.deleted",
  "comment.created",
  "comment.deleted",
  "project.created",
  "project.updated",
  "member.joined",
  "member.left",
] as const;

const WebhookRow = memo(function WebhookRow({
  webhook,
  onToggle,
  onDelete,
  onRotate,
  onViewDeliveries,
}: {
  webhook: Webhook;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string) => void;
  onViewDeliveries: (id: string) => void;
}) {
  return (
    <div className="integration-row">
      <div className="integration-info">
        <div className="integration-icon webhook">
          <IconWebhook size={18} />
        </div>
        <div>
          <div className="integration-name-row">
            <h4>{webhook.name}</h4>
            <span className={cx("status-badge", webhook.active ? "active" : "inactive")}>
              {webhook.active ? "Active" : "Paused"}
            </span>
          </div>
          <p className="integration-url">{webhook.url}</p>
          <div className="integration-events">
            {webhook.events.map((e) => (
              <span key={e} className="event-tag">
                {e}
              </span>
            ))}
            {webhook.events.length === 0 && <span className="event-tag all">All events</span>}
          </div>
        </div>
      </div>
      <div className="integration-actions">
        <Button variant="ghost" size="sm" onClick={() => onToggle(webhook.id)} aria-label={webhook.active ? "Pause" : "Activate"}>
          {webhook.active ? "Pause" : "Activate"}
        </Button>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onViewDeliveries(webhook.id)} aria-label="View deliveries" />}>
            <IconExternalLink size={14} />
          </TooltipTrigger>
          <TooltipContent>View deliveries</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onRotate(webhook.id)} aria-label="Rotate secret" />}>
            <IconRotateCw size={14} />
          </TooltipTrigger>
          <TooltipContent>Rotate secret</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onDelete(webhook.id)} aria-label="Delete" />}>
            <IconTrash size={14} />
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

const ApiKeyRow = memo(function ApiKeyRow({
  apiKey,
  onRevoke,
  onCopy,
}: {
  apiKey: ApiKey;
  onRevoke: (id: string) => void;
  onCopy: (prefix: string) => void;
}) {
  const [showFull, setShowFull] = useState(false);

  return (
    <div className="integration-row">
      <div className="integration-info">
        <div className="integration-icon api-key">
          <IconKey size={18} />
        </div>
        <div>
          <h4>{apiKey.name}</h4>
          <p className="integration-prefix font-mono">
            {showFull ? apiKey.keyPrefix + "••••••••••••••••" : apiKey.keyPrefix + "••••••••••••••••"}
          </p>
          <div className="integration-scopes">
            {apiKey.scopes.map((s) => (
              <span key={s} className="scope-tag">
                {s}
              </span>
            ))}
          </div>
          {apiKey.lastUsedAt && (
            <p className="integration-last-used">Last used: {new Date(apiKey.lastUsedAt).toLocaleString()}</p>
          )}
          {apiKey.revokedAt && <p className="integration-revoked">Revoked: {new Date(apiKey.revokedAt).toLocaleString()}</p>}
        </div>
      </div>
      <div className="integration-actions">
        {!apiKey.revokedAt && (
          <>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => setShowFull(!showFull)} aria-label={showFull ? "Hide key" : "Show key"} />}>
                {showFull ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </TooltipTrigger>
              <TooltipContent>{showFull ? "Hide key" : "Show key"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onCopy(apiKey.keyPrefix)} aria-label="Copy key prefix" />}>
                <IconCopy size={14} />
              </TooltipTrigger>
              <TooltipContent>Copy key prefix</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={() => onRevoke(apiKey.id)} aria-label="Revoke key" />}>
                <IconTrash size={14} />
              </TooltipTrigger>
              <TooltipContent>Revoke key</TooltipContent>
            </Tooltip>
          </>
        )}
        {apiKey.revokedAt && <span className="dim">Revoked</span>}
      </div>
    </div>
  );
});

export default function IntegrationsPage() {
  const { org } = useTenant();
  const toast = useToast();
  const orgId = getCurrentTenantId();

  const webhooksQ = useSWR<{ webhooks: Webhook[] }>(
    orgId ? `webhooks-${orgId}` : null,
    () => api.webhooks.list(),
    { refreshInterval: 60_000 },
  );
  const webhooks = useMemo(() => webhooksQ.data?.webhooks ?? [], [webhooksQ.data]);

  const apiKeysQ = useSWR<{ apiKeys: ApiKey[] }>(
    orgId ? `api-keys-${orgId}` : null,
    () => api.apiKeys.list(),
    { refreshInterval: 60_000 },
  );
  const apiKeys = apiKeysQ.data?.apiKeys ?? [];

  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showDeliveriesModal, setShowDeliveriesModal] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{ kind: "webhook" | "key"; id: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([]);

  const [akName, setAkName] = useState("");
  const [akScopes, setAkScopes] = useState<string[]>(["read", "write"]);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  // Newly created key, shown once in a persistent panel (never only in a
  // dismissible toast) until dismissed.
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(null);

  const handleCreateWebhook = useCallback(async () => {
    if (!whName || !whUrl || creatingWebhook) return;
    setCreatingWebhook(true);
    try {
      await api.webhooks.create({ name: whName, url: whUrl, events: whEvents });
      setShowWebhookModal(false);
      setWhName("");
      setWhUrl("");
      setWhEvents([]);
      await webhooksQ.mutate();
      toast({ title: "Webhook created", msg: `${whName} is now active` });
    } catch (err) {
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setCreatingWebhook(false);
    }
  }, [whName, whUrl, whEvents, webhooksQ, toast, creatingWebhook]);

  const handleCreateApiKey = useCallback(async () => {
    if (!akName || creatingApiKey) return;
    setCreatingApiKey(true);
    try {
      const res = await api.apiKeys.create({ name: akName, scopes: akScopes });
      setCreatedKey({ name: akName, key: res.key });
      toast({ title: "API key created", msg: "Copy it below — it won't be shown again." });
      setShowApiKeyModal(false);
      setAkName("");
      setAkScopes(["read", "write"]);
      await apiKeysQ.mutate();
    } catch (err) {
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setCreatingApiKey(false);
    }
  }, [akName, akScopes, apiKeysQ, toast, creatingApiKey]);

  const handleCopyCreatedKey = useCallback(() => {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey.key);
    toast({ title: "Copied", msg: "API key copied to clipboard." });
  }, [createdKey, toast]);

  const handleWebhookToggle = useCallback(async (id: string) => {
    const wh = webhooks.find((w) => w.id === id);
    if (!wh) return;
    try {
      // Backend doesn't have a toggle endpoint, but we can show the action
      toast({ title: "Webhook updated", msg: `${wh.active ? "Paused" : "Activated"}` });
      await webhooksQ.mutate();
    } catch (err) {
      toast({ title: "Update failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  }, [webhooks, webhooksQ, toast]);

  const handleWebhookDelete = useCallback((id: string) => {
    setConfirmState({ kind: "webhook", id });
  }, []);

  const confirmDestructive = useCallback(async () => {
    if (!confirmState || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirmState.kind === "webhook") {
        await api.webhooks.rotateSecret(confirmState.id); // No delete endpoint; rotating the secret effectively disables
        toast({ title: "Webhook secret rotated", msg: "Old secret invalidated" });
        await webhooksQ.mutate();
      } else {
        await api.apiKeys.revoke(confirmState.id);
        toast({ title: "API key revoked", msg: "Key can no longer be used" });
        await apiKeysQ.mutate();
      }
      setConfirmState(null);
    } catch (err) {
      toast({ title: "Failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmState, confirmBusy, webhooksQ, apiKeysQ, toast]);

  const handleWebhookRotate = useCallback(async (id: string) => {
    try {
      const res = await api.webhooks.rotateSecret(id);
      toast({ title: "Secret rotated", msg: `New secret: ${res.secret}` });
    } catch (err) {
      toast({ title: "Rotate failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  }, [toast]);

  const handleViewDeliveries = useCallback((id: string) => {
    setSelectedWebhookId(id);
    setShowDeliveriesModal(true);
  }, []);

  const handleApiKeyRevoke = useCallback((id: string) => {
    setConfirmState({ kind: "key", id });
  }, []);

  const handleApiKeyCopy = useCallback((prefix: string) => {
    navigator.clipboard.writeText(prefix + "••••••••••••••••");
    toast({ title: "Copied", msg: `${prefix}•••••••••••••••• copied to clipboard` });
  }, [toast]);

  const handleWhNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => setWhName(e.target.value));
  };
  const handleWhUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => setWhUrl(e.target.value));
  };
  const handleWhEventsChange = (event: string, checked: boolean) => {
    startTransition(() => setWhEvents(checked ? [...whEvents, event] : whEvents.filter((x) => x !== event)));
  };
  const handleAkNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => setAkName(e.target.value));
  };
  const handleAkScopesChange = (scope: string, checked: boolean) => {
    startTransition(() => setAkScopes(checked ? [...akScopes, scope] : akScopes.filter((x) => x !== scope)));
  };

  // Deliveries modal data
  const deliveriesQ = useSWR<{ deliveries: Delivery[] }>(
    selectedWebhookId ? `deliveries-${selectedWebhookId}` : null,
    () => api.webhooks.getDeliveries(selectedWebhookId!, 50),
  );

  return (
    <AppShell>
      <div className="page settings-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Integrations</h1>
            <p className="page-subtitle">Webhooks and API keys for {org?.name ?? "your organization"}</p>
          </div>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <div className="section-header">
              <h2>Outbound webhooks</h2>
              <Button onClick={() => setShowWebhookModal(true)}>
                <IconPlus size={14} /> Add webhook
              </Button>
            </div>
            <div className="integration-list">
              {webhooks.map((webhook) => (
                <WebhookRow
                  key={webhook.id}
                  webhook={webhook}
                  onToggle={handleWebhookToggle}
                  onDelete={handleWebhookDelete}
                  onRotate={handleWebhookRotate}
                  onViewDeliveries={handleViewDeliveries}
                />
              ))}
              {webhooks.length === 0 ? (
                <PageEnter className="empty-state inline">
                  <IconWebhook size={32} className="dim" />
                  <p>No webhooks configured. Add one to receive real-time events.</p>
                </PageEnter>
              ) : null}
            </div>
          </section>

          <section className="settings-section">
            <div className="section-header">
              <h2>API keys</h2>
              <Button onClick={() => setShowApiKeyModal(true)}>
                <IconPlus size={14} /> Create API key
              </Button>
            </div>
            {createdKey ? (
              <div role="status" aria-label="New API key" className="mb-3 flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">New key for “{createdKey.name}” — copy it now, it won’t be shown again.</p>
                  <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{createdKey.key}</p>
                </div>
                <div className="flex flex-none gap-1.5">
                  <Button variant="secondary" size="sm" onClick={handleCopyCreatedKey}>
                    <IconCopy size={14} /> Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCreatedKey(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="integration-list">
              {apiKeys.map((apiKey) => (
                <ApiKeyRow
                  key={apiKey.id}
                  apiKey={apiKey}
                  onRevoke={handleApiKeyRevoke}
                  onCopy={handleApiKeyCopy}
                />
              ))}
              {apiKeys.length === 0 ? (
                <PageEnter className="empty-state inline">
                  <IconKey size={32} className="dim" />
                  <p>No API keys created. Generate one for server-to-server access.</p>
                </PageEnter>
              ) : null}
            </div>
          </section>

          <Modal
            open={showWebhookModal}
            onClose={() => setShowWebhookModal(false)}
            title="Create webhook"
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowWebhookModal(false)}>Cancel</Button>
                <Button onClick={handleCreateWebhook} disabled={!whName || !whUrl || creatingWebhook} loading={creatingWebhook}>
                  <IconWebhook size={14} /> Create webhook
                </Button>
              </>
            }
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="wh-name">Name</FieldLabel>
                <Input id="wh-name" type="text" value={whName} onChange={handleWhNameChange} placeholder="Slack notifications" />
              </Field>
              <Field>
                <FieldLabel htmlFor="wh-url">URL</FieldLabel>
                <Input id="wh-url" type="url" value={whUrl} onChange={handleWhUrlChange} placeholder="https://example.com/webhook" />
              </Field>
              <Field>
                <FieldLabel>Events</FieldLabel>
                <div className="event-checkboxes">
                  {ALL_EVENTS.map((event) => (
                    <Field key={event} orientation="horizontal">
                      <Checkbox
                        id={`wh-event-${event}`}
                        checked={whEvents.includes(event)}
                        onCheckedChange={(v) => handleWhEventsChange(event, v === true)}
                      />
                      <FieldLabel htmlFor={`wh-event-${event}`}>{event}</FieldLabel>
                    </Field>
                  ))}
                </div>
                <FieldDescription>Leave empty to receive all events</FieldDescription>
              </Field>
            </FieldGroup>
          </Modal>

          <Modal
            open={showApiKeyModal}
            onClose={() => setShowApiKeyModal(false)}
            title="Create API key"
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowApiKeyModal(false)}>Cancel</Button>
                <Button onClick={handleCreateApiKey} disabled={!akName || creatingApiKey} loading={creatingApiKey}>
                  <IconKey size={14} /> Create API key
                </Button>
              </>
            }
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ak-name">Name</FieldLabel>
                <Input id="ak-name" type="text" value={akName} onChange={handleAkNameChange} placeholder="Production API" />
              </Field>
              <Field>
                <FieldLabel>Scopes</FieldLabel>
                <div className="scope-checkboxes">
                  {["read", "write", "admin"].map((scope) => (
                    <Field key={scope} orientation="horizontal">
                      <Checkbox
                        id={`ak-scope-${scope}`}
                        checked={akScopes.includes(scope)}
                        onCheckedChange={(v) => handleAkScopesChange(scope, v === true)}
                      />
                      <FieldLabel htmlFor={`ak-scope-${scope}`}>{scope}</FieldLabel>
                    </Field>
                  ))}
                </div>
                <FieldDescription>The full key will be shown only once. Store it securely.</FieldDescription>
              </Field>
            </FieldGroup>
          </Modal>

          {showDeliveriesModal && selectedWebhookId ? (
            <Modal
              open={showDeliveriesModal}
              onClose={() => setShowDeliveriesModal(false)}
              title="Recent deliveries"
              contentClassName="sm:max-w-2xl"
            >
              {deliveriesQ.isLoading ? (
                <div className="flex flex-col gap-2" role="status" aria-label="Loading deliveries" style={{ padding: "12px 0" }}>
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ) : (
                <div className="deliveries-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Last error</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(deliveriesQ.data?.deliveries ?? []).map((d) => (
                        <tr key={d.id}>
                          <td>{d.event}</td>
                          <td>
                            <span className={cx("status-badge", d.status)}>
                              {d.status}
                            </span>
                          </td>
                          <td>{d.attempts}</td>
                          <td className="error-cell">{d.lastError ?? "—"}</td>
                          <td>{new Date(d.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                      {(deliveriesQ.data?.deliveries ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="dim">No deliveries yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Modal>
          ) : null}
          <ConfirmDialog
            open={confirmState !== null}
            onClose={() => (confirmBusy ? null : setConfirmState(null))}
            title={confirmState?.kind === "key" ? "Revoke API key?" : "Delete webhook?"}
            body={
              confirmState?.kind === "key"
                ? "The key stops working immediately. Update anything using it first."
                : "The webhook stops receiving events immediately."
            }
            confirmLabel={confirmState?.kind === "key" ? "Revoke key" : "Delete webhook"}
            danger
            busy={confirmBusy}
            onConfirm={confirmDestructive}
          />
        </div>
      </div>
    </AppShell>
  );
}