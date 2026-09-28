"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Bell, Ban, CheckCircle2, ChevronLeft, ChevronRight, Edit3, Play, RefreshCw, Search, Send, Settings2, X } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Branch = { id: string; name: string };
type Summary = { total: number; scheduled: number; delivered: number; failed: number; cancelled: number; queueMode: string; provider: string };
type Template = { id: string; key: string; name: string; kind: string; channel: string; body: string; providerTemplateName?: string | null; locale: string; isActive: boolean };
type Policy = { renewalReminderDays: number[]; paymentReminderDays: number[]; renewalEnabled: boolean; paymentEnabled: boolean; leadFollowUpEnabled: boolean };
type Settings = { templates: Template[]; policy: Policy; canManage: boolean };
type Attempt = { id: string; attemptNumber: number; status: string; provider: string; errorMessage?: string | null; startedAt: string };
type Event = { id: string; kind: string; channel: string; recipientName: string; recipientAddress: string; renderedBody: string; scheduledAt: string; status: string; attemptCount: number; maxAttempts: number; errorMessage?: string | null; createdAt: string; template?: { name: string } | null; attempts: Attempt[] };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const kinds = ["MEMBERSHIP_RENEWAL", "PAYMENT_DUE", "LEAD_FOLLOW_UP", "CUSTOM"];
const statuses = ["SCHEDULED", "QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "CANCELLED"];
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const dateTime = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function NotificationsPanel({ branches, onNotice }: { branches: Branch[]; onNotice: (message: string) => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const loadSummary = useCallback(async () => { const response = await apiFetch("/notifications/summary"); if (response.ok) setSummary(await response.json()); }, []);
  const loadSettings = useCallback(async () => { const response = await apiFetch("/notifications/settings"); if (response.ok) setSettings(await response.json()); else onNotice(await responseMessage(response, "Could not load notification settings")); }, [onNotice]);
  const loadEvents = useCallback(async () => {
    setLoading(true); const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.trim()) params.set("search", search.trim()); if (status) params.set("status", status); if (kind) params.set("kind", kind); if (branchId) params.set("branchId", branchId);
    const response = await apiFetch(`/notifications?${params}`);
    if (response.ok) { const body = await response.json(); setEvents(body.items); setPagination(body.pagination); }
    else onNotice(await responseMessage(response, "Could not load notification history")); setLoading(false);
  }, [branchId, kind, onNotice, page, search, status]);

  useEffect(() => { void Promise.all([loadSummary(), loadSettings()]); }, [loadSettings, loadSummary]);
  useEffect(() => { const timer = window.setTimeout(() => void loadEvents(), 180); return () => window.clearTimeout(timer); }, [loadEvents]);
  useEffect(() => { setPage(1); }, [search, status, kind, branchId]);
  async function refresh() { await Promise.all([loadSummary(), loadSettings(), loadEvents()]); }

  async function runScheduler() {
    const response = await apiFetch("/notifications/run-scheduler", { method: "POST" }); if (!response.ok) return onNotice(await responseMessage(response, "Could not run reminder scheduler"));
    const result = await response.json(); onNotice(`Reminder scan queued ${result.created} notification${result.created === 1 ? "" : "s"}`); await refresh();
  }
  async function processQueue() {
    const response = await apiFetch("/notifications/process", { method: "POST" }); if (!response.ok) return onNotice(await responseMessage(response, "Could not process notification queue"));
    const result = await response.json(); onNotice(result.mode === "REDIS" ? "Redis worker is processing queued notifications" : `Processed ${result.processed} notification${result.processed === 1 ? "" : "s"}`); await refresh();
  }
  async function retry(event: Event) { const response = await apiFetch(`/notifications/${event.id}/retry`, { method: "POST" }); if (!response.ok) return onNotice(await responseMessage(response, "Could not retry notification")); onNotice("Notification retried"); await refresh(); }
  async function cancel(event: Event) { const response = await apiFetch(`/notifications/${event.id}/cancel`, { method: "POST" }); if (!response.ok) return onNotice(await responseMessage(response, "Could not cancel notification")); onNotice("Notification cancelled"); await refresh(); }

  async function updateTemplate(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (!editing) return; const form = formEvent.currentTarget; const data = Object.fromEntries(new FormData(form));
    const response = await apiFetch(`/notifications/templates/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...data, isActive: new FormData(form).get("isActive") === "on" }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not update template")); setEditing(null); onNotice("Notification template updated"); await loadSettings();
  }

  async function updatePolicy(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); const data = new FormData(formEvent.currentTarget); const numbers = (name: string) => String(data.get(name) ?? "").split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
    const response = await apiFetch("/notifications/policy", { method: "PATCH", body: JSON.stringify({ renewalReminderDays: numbers("renewalReminderDays"), paymentReminderDays: numbers("paymentReminderDays"), renewalEnabled: data.get("renewalEnabled") === "on", paymentEnabled: data.get("paymentEnabled") === "on", leadFollowUpEnabled: data.get("leadFollowUpEnabled") === "on" }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not update reminder policy")); onNotice("Reminder policy updated"); await loadSettings();
  }

  async function sendTest(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); const form = formEvent.currentTarget; const data = Object.fromEntries(new FormData(form));
    const response = await apiFetch("/notifications/test", { method: "POST", body: JSON.stringify({ ...data, simulateFailure: new FormData(form).get("simulateFailure") === "on" }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not queue test notification")); const event = await response.json(); setTestOpen(false); onNotice(`Test notification ${label(event.status).toLowerCase()}`); await refresh();
  }

  return <div className="notifications-workspace">
    <div className="notifications-topbar"><div><span className="eyebrow">ENGAGEMENT OPERATIONS</span><h2>Notifications</h2><small>{summary?.queueMode === "REDIS" ? "Redis queue" : "Local durable queue"} · {summary?.provider ?? "simulated"} provider</small></div>{settings?.canManage && <div className="topbar-actions"><button className="secondary" onClick={() => setTestOpen(true)}><Send size={16} /> Test send</button><button className="primary" onClick={() => void runScheduler()}><Play size={16} /> Run reminders</button></div>}</div>
    <section className="notification-summary"><article><span>Total</span><strong>{summary?.total ?? 0}</strong><small>Recorded events</small></article><article><span>Scheduled</span><strong>{summary?.scheduled ?? 0}</strong><small>Awaiting delivery</small></article><article><span>Delivered</span><strong>{summary?.delivered ?? 0}</strong><small>Provider accepted</small></article><article><span>Failed</span><strong>{summary?.failed ?? 0}</strong><small>Needs attention</small></article></section>
    <section className="workspace"><div className="section-heading member-heading"><div><span className="eyebrow">DELIVERY LEDGER</span><h2>Notification history</h2><small>{pagination.total} events</small></div>{settings?.canManage && <button className="secondary compact" onClick={() => void processQueue()}><RefreshCw size={15} /> Process queue</button>}</div>
      <div className="notification-filters"><label className="search"><Search size={17} /><input aria-label="Search notifications" placeholder="Recipient or message" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select aria-label="Filter notification status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select aria-label="Filter notification type" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All types</option>{kinds.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select aria-label="Filter notification branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
      <div className="table-wrap"><table><thead><tr><th>Recipient</th><th>Type</th><th>Message</th><th>Scheduled</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><strong>{event.recipientName}</strong><small>{event.recipientAddress} · {label(event.channel)}</small></td><td>{label(event.kind)}</td><td className="message-cell"><span>{event.renderedBody}</span>{event.errorMessage && <small className="overdue-text">{event.errorMessage}</small>}</td><td>{dateTime(event.scheduledAt)}<small>{event.attemptCount}/{event.maxAttempts} attempts</small></td><td><span className={`notification-status ${event.status.toLowerCase()}`}>{label(event.status)}</span></td><td><div className="table-actions">{settings?.canManage && event.status === "FAILED" && <button className="icon-button compact-icon" title="Retry notification" onClick={() => void retry(event)}><RefreshCw size={15} /></button>}{settings?.canManage && ["SCHEDULED", "QUEUED", "FAILED"].includes(event.status) && <button className="icon-button compact-icon" title="Cancel notification" onClick={() => void cancel(event)}><Ban size={15} /></button>}</div></td></tr>)}{!loading && !events.length && <tr><td className="empty" colSpan={6}>No notifications match these filters.</td></tr>}{loading && <tr><td className="empty" colSpan={6}>Loading notifications...</td></tr>}</tbody></table></div>
      <div className="pagination"><span>Page {pagination.page} of {pagination.totalPages}</span><div><button className="icon-button" disabled={page <= 1} title="Previous page" onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><button className="icon-button" disabled={page >= pagination.totalPages} title="Next page" onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
    </section>
    {settings?.canManage && <section className="notification-settings-grid"><section className="workspace notification-templates"><div className="section-heading"><div><span className="eyebrow">CONTENT</span><h2>Templates</h2></div></div>{settings.templates.map((template) => <article key={template.id}><div><strong>{template.name}</strong><small>{label(template.channel)} · {template.locale} · {template.isActive ? "Active" : "Inactive"}</small><p>{template.body}</p></div><button className="icon-button" title={`Edit ${template.name}`} onClick={() => setEditing(template)}><Edit3 size={16} /></button></article>)}</section><section className="workspace reminder-policy"><div className="section-heading"><div><span className="eyebrow">AUTOMATION</span><h2>Reminder policy</h2></div></div><form onSubmit={(event) => void updatePolicy(event)}><label className="full">Renewal days before expiry<input name="renewalReminderDays" defaultValue={settings.policy.renewalReminderDays.join(", ")} /></label><label className="full">Payment days after due date<input name="paymentReminderDays" defaultValue={settings.policy.paymentReminderDays.join(", ")} /></label><label className="toggle-row full"><input type="checkbox" name="renewalEnabled" defaultChecked={settings.policy.renewalEnabled} /> Membership reminders</label><label className="toggle-row full"><input type="checkbox" name="paymentEnabled" defaultChecked={settings.policy.paymentEnabled} /> Payment reminders</label><label className="toggle-row full"><input type="checkbox" name="leadFollowUpEnabled" defaultChecked={settings.policy.leadFollowUpEnabled} /> Internal lead reminders</label><div className="form-actions full"><button className="primary" type="submit"><Settings2 size={16} /> Save policy</button></div></form></section></section>}
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><div className="modal member-form-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">MESSAGE TEMPLATE</span><h2>Edit template</h2></div><button className="icon-button" aria-label="Close" onClick={() => setEditing(null)}><X size={20} /></button></div><form onSubmit={(event) => void updateTemplate(event)}><label>Name<input name="name" required defaultValue={editing.name} /></label><label>Provider template<input name="providerTemplateName" defaultValue={editing.providerTemplateName ?? ""} /></label><label>Locale<input name="locale" required defaultValue={editing.locale} /></label><label className="toggle-row"><input type="checkbox" name="isActive" defaultChecked={editing.isActive} /> Active</label><label className="full">Message body<textarea name="body" rows={6} required defaultValue={editing.body} /></label><div className="template-variables full"><strong>Available variables</strong><span>{editing.kind === "MEMBERSHIP_RENEWAL" ? "{{name}}, {{plan}}, {{gym}}, {{date}}" : editing.kind === "PAYMENT_DUE" ? "{{name}}, {{amount}}, {{invoiceNumber}}, {{gym}}, {{dueState}}" : "{{leadName}}, {{phone}}, {{purpose}}"}</span></div><div className="form-actions full"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button><button className="primary" type="submit"><CheckCircle2 size={16} /> Save template</button></div></form></div></div>}
    {testOpen && settings && <div className="modal-backdrop" role="presentation" onMouseDown={() => setTestOpen(false)}><div className="modal small-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">SIMULATED PROVIDER</span><h2>Test notification</h2></div><button className="icon-button" aria-label="Close" onClick={() => setTestOpen(false)}><X size={20} /></button></div><form onSubmit={(event) => void sendTest(event)}><label className="full">Template<select name="templateKey" required>{settings.templates.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.key}>{item.name}</option>)}</select></label><label>Recipient name<input name="recipientName" required /></label><label>Phone or address<input name="recipientAddress" required /></label><label className="toggle-row full"><input name="simulateFailure" type="checkbox" /> Simulate provider failure</label><div className="form-actions full"><button type="button" className="secondary" onClick={() => setTestOpen(false)}>Cancel</button><button className="primary" type="submit"><Send size={16} /> Send test</button></div></form></div></div>}
  </div>;
}
