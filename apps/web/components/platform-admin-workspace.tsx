"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Building2, Check, Clipboard, History, LogOut, Menu, PauseCircle, Plus, RefreshCcw, Search, ShieldCheck, Users, X } from "lucide-react";
import { platformApiFetch, responseMessage } from "../lib/api";

type Admin = { platformAdminId: string; name: string; email: string };
type TenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
type Tenant = { id: string; name: string; slug: string; status: TenantStatus; subscriptionPlan: string; currency: string; timezone: string; createdAt: string; _count: { branches: number; users: number; members: number } };
type TenantDetail = Tenant & { updatedAt: string; branches: { id: string; name: string; code: string; address?: string; isActive: boolean }[]; users: { id: string; name: string; email: string; status: string; lastLoginAt?: string; createdAt: string }[]; invitations: { id: string; name: string; email: string; expiresAt: string; acceptedAt?: string; createdAt: string }[] };
type AuditEvent = { id: string; action: string; entityType: string; entityId: string; createdAt: string; platformAdmin?: { name: string; email: string }; tenant?: { name: string; slug: string }; metadata?: Record<string, unknown> };

const statusLabel: Record<TenantStatus, string> = { TRIAL: "Trial", ACTIVE: "Active", SUSPENDED: "Suspended", CANCELLED: "Archived" };

export function PlatformAdminWorkspace() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<TenantDetail | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const authenticate = useCallback(async () => {
    const response = await platformApiFetch("/auth/me");
    setAdmin(response.ok ? await response.json() : null);
    setAuthReady(true);
  }, []);

  const loadTenants = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    const response = await platformApiFetch(`/tenants${params.size ? `?${params}` : ""}`);
    if (response.ok) setTenants(await response.json());
    else setNotice(await responseMessage(response, "Could not load gyms"));
  }, [search, status]);

  const loadAudits = useCallback(async () => {
    const response = await platformApiFetch("/audit-events");
    if (response.ok) setAudits(await response.json());
  }, []);

  const openTenant = useCallback(async (tenantId: string) => {
    const response = await platformApiFetch(`/tenants/${tenantId}`);
    if (response.ok) setSelected(await response.json());
    else setNotice(await responseMessage(response, "Could not load gym details"));
  }, []);

  useEffect(() => { void authenticate(); }, [authenticate]);
  useEffect(() => { if (admin) { void loadTenants(); void loadAudits(); } }, [admin, loadTenants, loadAudits]);

  const totals = useMemo(() => tenants.reduce((acc, tenant) => ({ branches: acc.branches + tenant._count.branches, users: acc.users + tenant._count.users, members: acc.members + tenant._count.members }), { branches: 0, users: 0, members: 0 }), [tenants]);

  async function login(formData: FormData) {
    setBusy(true); setNotice("");
    const response = await platformApiFetch("/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) }, false);
    if (response.ok) await authenticate(); else setNotice(await responseMessage(response, "Could not sign in"));
    setBusy(false);
  }

  async function logout() {
    await platformApiFetch("/auth/logout", { method: "POST" }, false);
    setAdmin(null); setTenants([]); setSelected(null);
  }

  async function createTenant(formData: FormData) {
    setBusy(true); setNotice("");
    const body = Object.fromEntries(formData);
    const response = await platformApiFetch("/tenants", { method: "POST", body: JSON.stringify(body) });
    if (response.ok) {
      const result = await response.json();
      setCreateOpen(false); setInvitationUrl(result.invitationUrl); setNotice(`${result.tenant.name} created successfully`);
      await loadTenants(); await loadAudits(); await openTenant(result.tenant.id);
    } else setNotice(await responseMessage(response, "Could not create gym"));
    setBusy(false);
  }

  async function changeStatus(action: "suspend" | "reactivate" | "archive") {
    if (!selected) return;
    const verb = action === "archive" ? "archive" : action;
    if (!window.confirm(`${verb.charAt(0).toUpperCase()}${verb.slice(1)} ${selected.name}?`)) return;
    setBusy(true); setNotice("");
    const response = await platformApiFetch(`/tenants/${selected.id}/${action}`, { method: "POST" });
    if (response.ok) {
      const resultLabel = action === "suspend" ? "suspended" : action === "reactivate" ? "reactivated" : "archived";
      setNotice(`${selected.name} ${resultLabel}`);
      await loadTenants(); await openTenant(selected.id); await loadAudits();
    } else setNotice(await responseMessage(response, `Could not ${action} gym`));
    setBusy(false);
  }

  async function reissueInvitation() {
    if (!selected) return;
    setBusy(true); setNotice("");
    const response = await platformApiFetch(`/tenants/${selected.id}/owner-invitations`, { method: "POST" });
    if (response.ok) {
      const result = await response.json(); setInvitationUrl(result.invitationUrl); setNotice("Owner invitation reissued");
      await openTenant(selected.id); await loadAudits();
    } else setNotice(await responseMessage(response, "Could not reissue invitation"));
    setBusy(false);
  }

  async function copyInvitation() {
    await navigator.clipboard.writeText(invitationUrl); setNotice("Invitation link copied");
  }

  if (!authReady) return <div className="auth-loading">Opening platform administration...</div>;
  if (!admin) return <PlatformLogin notice={notice} busy={busy} onLogin={login} />;

  return <div className="platform-shell">
    <aside className={`platform-sidebar${navOpen ? " open" : ""}`}>
      <div className="brand"><span className="brand-mark">G</span><span>Gym OS</span></div>
      <nav aria-label="Platform navigation">
        <button className={!auditOpen ? "active" : ""} onClick={() => { setAuditOpen(false); setNavOpen(false); }}><Building2 size={18} /> Gyms</button>
        <button className={auditOpen ? "active" : ""} onClick={() => { setAuditOpen(true); setSelected(null); setNavOpen(false); }}><History size={18} /> Audit history</button>
      </nav>
      <button className="settings" onClick={() => void logout()}><LogOut size={18} /> Sign out</button>
    </aside>
    {navOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}

    <main className="platform-main">
      <header>
        <button className="icon-button menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
        <div><span className="eyebrow">SAAS CONTROL PLANE</span><h1>{auditOpen ? "Platform audit" : "Gym tenants"}</h1></div>
        <div className="header-actions"><div className="signed-in"><strong>{admin.name}</strong><small>Platform Administrator</small></div>{!auditOpen && <button className="primary" onClick={() => setCreateOpen(true)}><Plus size={17} /> Create gym</button>}</div>
      </header>

      {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<X size={15} /></button>}

      {!auditOpen ? <>
        <section className="platform-summary" aria-label="Tenant totals">
          <article><Building2 size={18} /><span>Gyms</span><strong>{tenants.length}</strong></article>
          <article><ShieldCheck size={18} /><span>Active or trial</span><strong>{tenants.filter((tenant) => tenant.status === "ACTIVE" || tenant.status === "TRIAL").length}</strong></article>
          <article><Users size={18} /><span>Staff accounts</span><strong>{totals.users}</strong></article>
          <article><Users size={18} /><span>Members</span><strong>{totals.members}</strong></article>
        </section>

        <section className="workspace platform-directory">
          <div className="section-heading platform-filters">
            <div><span className="eyebrow">CUSTOMER DIRECTORY</span><h2>Organizations</h2></div>
            <label className="search"><Search size={17} /><input aria-label="Search gyms" placeholder="Search gym or workspace" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label className="filter-field"><span className="sr-only">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Archived</option></select></label>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Gym</th><th>Plan</th><th>Status</th><th>Branches</th><th>Staff</th><th>Members</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>
            {tenants.map((tenant) => <tr key={tenant.id}><td><strong>{tenant.name}</strong><small>{tenant.slug}</small></td><td>{tenant.subscriptionPlan}</td><td><span className={`status ${tenant.status.toLowerCase()}`}>{statusLabel[tenant.status]}</span></td><td>{tenant._count.branches}</td><td>{tenant._count.users}</td><td>{tenant._count.members}</td><td className="row-action"><button className="secondary compact" onClick={() => void openTenant(tenant.id)}>Open</button></td></tr>)}
            {!tenants.length && <tr><td className="empty" colSpan={7}>No gyms match the current filters.</td></tr>}
          </tbody></table></div>
        </section>

        {selected && <TenantDetails tenant={selected} busy={busy} onClose={() => setSelected(null)} onSuspend={() => void changeStatus("suspend")} onReactivate={() => void changeStatus("reactivate")} onArchive={() => void changeStatus("archive")} onReissue={() => void reissueInvitation()} />}
      </> : <AuditHistory events={audits} />}
    </main>

    {createOpen && <div className="modal-backdrop" onMouseDown={() => setCreateOpen(false)}><div className="modal platform-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-gym-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">NEW CUSTOMER</span><h2 id="create-gym-title">Create gym</h2></div><button className="icon-button" aria-label="Close" onClick={() => setCreateOpen(false)}><X size={19} /></button></div>
      <form action={createTenant}>
        <label>Gym name<input name="name" required minLength={2} autoFocus /></label>
        <label>Workspace slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="example-fitness" /></label>
        <label>First branch<input name="branchName" required defaultValue="Main Branch" /></label>
        <label>Branch code<input name="branchCode" required minLength={2} maxLength={12} defaultValue="HQ" /></label>
        <label className="full">Branch address<input name="branchAddress" /></label>
        <label>Owner name<input name="ownerName" required minLength={2} /></label>
        <label>Owner email<input name="ownerEmail" type="email" required /></label>
        <label>Plan<select name="subscriptionPlan" defaultValue="PILOT"><option value="PILOT">Pilot</option><option value="STARTER">Starter</option><option value="GROWTH">Growth</option><option value="SCALE">Scale</option></select></label>
        <label>Timezone<input name="timezone" defaultValue="Asia/Kolkata" required /></label>
        <input type="hidden" name="currency" value="INR" />
        <div className="form-actions full"><button type="button" className="secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="primary" disabled={busy}><Plus size={17} /> {busy ? "Creating..." : "Create gym"}</button></div>
      </form>
    </div></div>}

    {invitationUrl && <div className="modal-backdrop" onMouseDown={() => setInvitationUrl("")}><div className="modal small-modal" role="dialog" aria-modal="true" aria-labelledby="owner-invite-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="invite-result"><span className="auth-icon"><Check size={23} /></span><h3 id="owner-invite-title">Owner invitation ready</h3><p>Share this one-time link securely. It expires after 72 hours.</p><div className="copy-row"><input readOnly value={invitationUrl} aria-label="Owner invitation link" /><button className="icon-button" aria-label="Copy invitation link" title="Copy invitation link" onClick={() => void copyInvitation()}><Clipboard size={17} /></button></div><button className="primary" onClick={() => setInvitationUrl("")}>Done</button></div>
    </div></div>}
  </div>;
}

function PlatformLogin({ notice, busy, onLogin }: { notice: string; busy: boolean; onLogin: (formData: FormData) => Promise<void> }) {
  return <main className="auth-page platform-auth-page"><section className="auth-panel"><div className="auth-brand"><span className="brand-mark">G</span> Gym OS</div><div className="auth-copy"><span className="auth-icon"><ShieldCheck size={24} /></span><span className="eyebrow">PLATFORM ADMINISTRATION</span><h1>Manage gym customers</h1><p>Sign in to provision and control isolated gym workspaces.</p></div>{notice && <div className="auth-error">{notice}</div>}<form className="auth-form" action={onLogin}><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><button className="primary" disabled={busy}><ShieldCheck size={17} /> {busy ? "Signing in..." : "Sign in"}</button></form><a className="auth-back" href="/">Return to gym sign-in</a></section><aside className="auth-aside platform-auth-aside"><div><span>Controlled onboarding</span><strong>Every gym.<br />Fully isolated.</strong><p>Provision customers without entering their operational workspace.</p></div></aside></main>;
}

function TenantDetails({ tenant, busy, onClose, onSuspend, onReactivate, onArchive, onReissue }: { tenant: TenantDetail; busy: boolean; onClose: () => void; onSuspend: () => void; onReactivate: () => void; onArchive: () => void; onReissue: () => void }) {
  const latestInvite = tenant.invitations[0];
  return <section className="workspace platform-tenant-detail"><div className="section-heading"><div><span className="eyebrow">TENANT DETAILS</span><h2>{tenant.name}</h2></div><div className="table-actions">{(tenant.status === "ACTIVE" || tenant.status === "TRIAL") && <button className="secondary compact" disabled={busy} onClick={onSuspend}><PauseCircle size={15} /> Suspend</button>}{(tenant.status === "SUSPENDED" || tenant.status === "CANCELLED" || tenant.status === "TRIAL") && <button className="secondary compact" disabled={busy} onClick={onReactivate}><RefreshCcw size={15} /> Reactivate</button>}{tenant.status !== "CANCELLED" && <button className="secondary compact danger" disabled={busy} onClick={onArchive}><Archive size={15} /> Archive</button>}<button className="icon-button" aria-label="Close details" onClick={onClose}><X size={17} /></button></div></div>
    <div className="platform-detail-grid"><dl><div><dt>Workspace</dt><dd>{tenant.slug}</dd></div><div><dt>Status</dt><dd><span className={`status ${tenant.status.toLowerCase()}`}>{statusLabel[tenant.status]}</span></dd></div><div><dt>Plan</dt><dd>{tenant.subscriptionPlan}</dd></div><div><dt>Created</dt><dd>{new Date(tenant.createdAt).toLocaleDateString("en-IN")}</dd></div></dl><div className="platform-detail-column"><h3>Branches</h3>{tenant.branches.map((branch) => <p key={branch.id}><strong>{branch.name}</strong><small>{branch.code}{branch.address ? ` · ${branch.address}` : ""}</small></p>)}</div><div className="platform-detail-column"><h3>Owners</h3>{tenant.users.map((owner) => <p key={owner.id}><strong>{owner.name}</strong><small>{owner.email} · {owner.status.toLowerCase()}</small></p>)}{!tenant.users.length && <p><strong>Invitation pending</strong><small>{latestInvite?.email ?? "No invitation"}</small></p>}{!tenant.users.length && latestInvite && <button className="secondary compact" disabled={busy || tenant.status === "SUSPENDED" || tenant.status === "CANCELLED"} onClick={onReissue}><RefreshCcw size={14} /> Reissue link</button>}</div></div>
  </section>;
}

function AuditHistory({ events }: { events: AuditEvent[] }) {
  return <section className="workspace platform-audit"><div className="section-heading"><div><span className="eyebrow">PLATFORM SECURITY</span><h2>Recent actions</h2></div><small>Latest 100 events</small></div><div className="table-wrap"><table><thead><tr><th>Action</th><th>Gym</th><th>Administrator</th><th>Date</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><strong>{event.action.replaceAll("_", " ").toLowerCase()}</strong><small>{event.entityType}</small></td><td>{event.tenant?.name ?? "Platform"}<small>{event.tenant?.slug}</small></td><td>{event.platformAdmin?.name ?? "System"}<small>{event.platformAdmin?.email}</small></td><td>{new Date(event.createdAt).toLocaleString("en-IN")}</td></tr>)}{!events.length && <tr><td className="empty" colSpan={4}>No platform actions recorded.</td></tr>}</tbody></table></div></section>;
}
