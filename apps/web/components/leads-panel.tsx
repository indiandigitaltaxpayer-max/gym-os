"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Archive, CalendarPlus, Check, ChevronLeft, ChevronRight, Edit3, MessageSquarePlus, Plus, RefreshCw, Search, UserCheck, X } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Branch = { id: string; name: string };
type Assignee = { id: string; name: string; branchIds: string[]; isOwner: boolean };
type Options = { branches: Branch[]; assignees: Assignee[]; canReassign: boolean };
type FollowUp = { id: string; purpose: string; dueAt: string; status: string; outcome?: string | null; completedAt?: string | null; assignedTo: { id: string; name: string } };
type Activity = { id: string; type: string; summary: string; createdAt: string; actor?: { name: string } | null };
type Lead = {
  id: string; branchId: string; assignedToUserId: string; firstName: string; lastName: string; phone: string; email?: string | null;
  source: string; sourceDetail?: string | null; stage: string; lossReason?: string | null; archivedAt?: string | null; convertedAt?: string | null;
  branch: Branch; assignedTo: { id: string; name: string }; convertedMember?: { id: string; memberNumber: string } | null; followUps: FollowUp[];
};
type LeadDetail = Lead & { activities: Activity[]; followUps: FollowUp[]; createdBy: { name: string } };
type Summary = { total: number; new: number; active: number; converted: number; lost: number; conversionRate: number; byStage: Record<string, number> };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const stages = ["NEW", "CONTACTED", "TRIAL_SCHEDULED", "TRIAL_COMPLETED", "CONVERTED", "LOST"];
const sources = ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "OTHER"];
const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
const dateTime = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function LeadsPanel({ currentUserId, onNotice, onLeadsChanged }: { currentUserId: string; onNotice: (message: string) => void; onLeadsChanged: () => Promise<void> }) {
  const [options, setOptions] = useState<Options>({ branches: [], assignees: [], canReassign: false });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [branchId, setBranchId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [due, setDue] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<LeadDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    const response = await apiFetch("/leads/options");
    if (response.ok) setOptions(await response.json());
    else onNotice(await responseMessage(response, "Could not load lead options"));
  }, [onNotice]);

  const loadSummary = useCallback(async () => {
    const params = new URLSearchParams(); if (branchId) params.set("branchId", branchId);
    const response = await apiFetch(`/leads/summary?${params}`);
    if (response.ok) setSummary(await response.json());
  }, [branchId]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20", includeArchived: String(includeArchived) });
    if (search.trim()) params.set("search", search.trim()); if (stage) params.set("stage", stage); if (source) params.set("source", source);
    if (branchId) params.set("branchId", branchId); if (assigneeId) params.set("assignedToUserId", assigneeId); if (due) params.set("due", due);
    const response = await apiFetch(`/leads?${params}`);
    if (response.ok) { const body = await response.json(); setLeads(body.items); setPagination(body.pagination); }
    else onNotice(await responseMessage(response, "Could not load leads"));
    setLoading(false);
  }, [assigneeId, branchId, due, includeArchived, onNotice, page, search, source, stage]);

  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { const timer = window.setTimeout(() => void loadLeads(), 180); return () => window.clearTimeout(timer); }, [loadLeads]);
  useEffect(() => { setPage(1); }, [search, stage, source, branchId, assigneeId, due, includeArchived]);

  async function refresh() { await Promise.all([loadLeads(), loadSummary(), onLeadsChanged()]); }
  async function openLead(id: string) {
    const response = await apiFetch(`/leads/${id}`);
    if (response.ok) setSelected(await response.json()); else onNotice(await responseMessage(response, "Could not open lead"));
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await apiFetch("/leads", { method: "POST", body: JSON.stringify(data) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not create lead"));
    const body = await response.json(); setCreateOpen(false); onNotice(body.warnings.length ? `Lead created. ${body.warnings[0].message}` : "Lead created successfully"); await refresh();
  }

  async function updateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await apiFetch(`/leads/${selected.id}`, { method: "PATCH", body: JSON.stringify(data) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not update lead"));
    const body = await response.json(); setEditOpen(false); onNotice(body.warnings.length ? `Lead updated. ${body.warnings[0].message}` : "Lead updated"); await openLead(selected.id); await refresh();
  }

  async function changeStage(next: string) {
    if (!selected || next === selected.stage || next === "CONVERTED") return;
    const lossReason = next === "LOST" ? window.prompt("Reason this lead was lost") : undefined;
    if (next === "LOST" && !lossReason?.trim()) return;
    const response = await apiFetch(`/leads/${selected.id}/stage`, { method: "POST", body: JSON.stringify({ stage: next, lossReason }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not change lead stage"));
    onNotice(`Lead moved to ${label(next)}`); await openLead(selected.id); await refresh();
  }

  async function assign(next: string) {
    if (!selected || next === selected.assignedToUserId) return;
    const response = await apiFetch(`/leads/${selected.id}/assign`, { method: "POST", body: JSON.stringify({ assignedToUserId: next }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not reassign lead"));
    onNotice("Lead reassigned"); await openLead(selected.id); await refresh();
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = event.currentTarget; const body = String(new FormData(form).get("body") ?? "");
    const response = await apiFetch(`/leads/${selected.id}/notes`, { method: "POST", body: JSON.stringify({ body }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not add note")); form.reset(); await openLead(selected.id);
  }

  async function scheduleFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await apiFetch(`/leads/${selected.id}/follow-ups`, { method: "POST", body: JSON.stringify(data) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not schedule follow-up"));
    setFollowUpOpen(false); onNotice("Follow-up scheduled"); await openLead(selected.id); await refresh();
  }

  async function closeFollowUp(followUp: FollowUp, action: "complete" | "cancel") {
    const value = window.prompt(action === "complete" ? "Follow-up outcome" : "Cancellation reason"); if (!value?.trim()) return;
    const response = await apiFetch(`/follow-ups/${followUp.id}/${action}`, { method: "POST", body: JSON.stringify(action === "complete" ? { outcome: value } : { reason: value }) });
    if (!response.ok) return onNotice(await responseMessage(response, `Could not ${action} follow-up`));
    onNotice(`Follow-up ${action === "complete" ? "completed" : "cancelled"}`); if (selected) await openLead(selected.id); await refresh();
  }

  async function assignFollowUp(followUp: FollowUp, assignedToUserId: string) {
    const response = await apiFetch(`/follow-ups/${followUp.id}/assign`, { method: "POST", body: JSON.stringify({ assignedToUserId }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not reassign follow-up"));
    onNotice("Follow-up reassigned"); if (selected) await openLead(selected.id); await refresh();
  }

  async function convert() {
    if (!selected || !window.confirm("Convert this lead into a trial member?")) return;
    const response = await apiFetch(`/leads/${selected.id}/convert`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not convert lead"));
    const body = await response.json(); onNotice(body.warnings.length ? `Member ${body.member.memberNumber} created. ${body.warnings[0].message}` : `Member ${body.member.memberNumber} created`); await openLead(selected.id); await refresh();
  }

  async function toggleArchive() {
    if (!selected) return; const action = selected.archivedAt ? "reactivate" : "archive";
    const response = await apiFetch(`/leads/${selected.id}/${action}`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, `Could not ${action} lead`));
    onNotice(`Lead ${action === "archive" ? "archived" : "reactivated"}`); setSelected(null); await refresh();
  }

  const pipeline = summary?.byStage ?? {};
  const availableAssignees = (targetBranch = selected?.branchId ?? options.branches[0]?.id) => options.assignees.filter((item) => item.isOwner || item.branchIds.includes(targetBranch ?? ""));

  return <div className="leads-workspace">
    <div className="leads-topbar"><div><span className="eyebrow">GROWTH DESK</span><h2>Leads</h2></div><button className="primary" onClick={() => setCreateOpen(true)}><Plus size={17} /> New lead</button></div>
    <section className="lead-summary" aria-label="Lead funnel summary">
      <article><span>Total leads</span><strong>{summary?.total ?? 0}</strong><small>{summary?.active ?? 0} active</small></article>
      <article><span>New</span><strong>{summary?.new ?? 0}</strong><small>Awaiting first contact</small></article>
      <article><span>Converted</span><strong>{summary?.converted ?? 0}</strong><small>{summary?.conversionRate ?? 0}% conversion</small></article>
      <article><span>Lost</span><strong>{summary?.lost ?? 0}</strong><small>Reason retained</small></article>
    </section>
    <section className="pipeline" aria-label="Lead pipeline">{stages.map((item) => <button key={item} className={stage === item ? "active" : ""} onClick={() => setStage(stage === item ? "" : item)}><span>{label(item)}</span><strong>{pipeline[item] ?? 0}</strong></button>)}</section>
    <section className="workspace">
      <div className="section-heading member-heading"><div><span className="eyebrow">PIPELINE DIRECTORY</span><h2>Lead records</h2><small>{pagination.total} matching leads</small></div></div>
      <div className="lead-filters">
        <label className="search"><Search size={17} /><input aria-label="Search leads" placeholder="Name, phone or email" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Filter source" value={source} onChange={(event) => setSource(event.target.value)}><option value="">All sources</option>{sources.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select>
        <select aria-label="Filter branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{options.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Filter assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">All assignees</option>{options.assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Filter follow-up due" value={due} onChange={(event) => setDue(event.target.value)}><option value="">Any follow-up</option><option value="DUE">Due today</option><option value="OVERDUE">Overdue</option></select>
        <label className="archive-toggle"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Archived</label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Lead</th><th>Stage</th><th>Source</th><th>Assignee</th><th>Next follow-up</th><th>Branch</th></tr></thead><tbody>
        {leads.map((lead) => { const next = lead.followUps[0]; const overdue = next && new Date(next.dueAt) < new Date(); return <tr key={lead.id} className={lead.archivedAt ? "archived-row" : ""} onClick={() => void openLead(lead.id)}>
          <td><strong>{lead.firstName} {lead.lastName}</strong><small>{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</small></td><td><span className={`lead-stage ${lead.stage.toLowerCase()}`}>{label(lead.stage)}</span></td><td>{label(lead.source)}</td><td>{lead.assignedTo.name}</td><td>{next ? <><strong className={overdue ? "overdue-text" : ""}>{dateTime(next.dueAt)}</strong><small>{next.purpose}</small></> : "-"}</td><td>{lead.branch.name}</td>
        </tr>; })}
        {!loading && !leads.length && <tr><td className="empty" colSpan={6}>No leads match these filters.</td></tr>}{loading && <tr><td className="empty" colSpan={6}>Loading leads...</td></tr>}
      </tbody></table></div>
      <div className="pagination"><span>Page {pagination.page} of {pagination.totalPages}</span><div><button className="icon-button" title="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><button className="icon-button" title="Next page" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
    </section>

    {createOpen && <LeadForm title="New lead" options={options} currentUserId={currentUserId} onSubmit={createLead} onClose={() => setCreateOpen(false)} />}
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><div className="modal lead-detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">{selected.branch.name.toUpperCase()}</span><h2>{selected.firstName} {selected.lastName}</h2></div><div className="profile-actions"><button className="icon-button" title="Edit lead" onClick={() => setEditOpen(true)}><Edit3 size={17} /></button><button className="icon-button" aria-label="Close" onClick={() => setSelected(null)}><X size={20} /></button></div></div>
      <div className="profile-content">
        {selected.archivedAt && <div className="archived-banner">This lead is archived.</div>}
        <div className="lead-controls"><label>Stage<select value={selected.stage} disabled={selected.stage === "CONVERTED" || Boolean(selected.archivedAt)} onChange={(event) => void changeStage(event.target.value)}>{stages.map((item) => <option key={item} value={item} disabled={item === "CONVERTED"}>{label(item)}</option>)}</select></label><label>Assignee<select value={selected.assignedToUserId} disabled={!options.canReassign || Boolean(selected.archivedAt)} onChange={(event) => void assign(event.target.value)}>{availableAssignees().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="profile-grid"><div className="profile-field"><span>Phone</span><strong>{selected.phone}</strong></div><div className="profile-field"><span>Email</span><strong>{selected.email || "Not provided"}</strong></div><div className="profile-field"><span>Source</span><strong>{label(selected.source)}{selected.sourceDetail ? ` · ${selected.sourceDetail}` : ""}</strong></div><div className="profile-field"><span>Owner</span><strong>{selected.assignedTo.name}</strong></div>{selected.lossReason && <div className="profile-field wide"><span>Loss reason</span><strong>{selected.lossReason}</strong></div>}{selected.convertedMember && <div className="profile-field wide"><span>Converted member</span><strong>{selected.convertedMember.memberNumber}</strong></div>}</div>
        <section className="profile-section"><div className="profile-section-heading"><h3>Follow-ups</h3>{!selected.archivedAt && selected.stage !== "CONVERTED" && selected.stage !== "LOST" && <button className="secondary compact" onClick={() => setFollowUpOpen(true)}><CalendarPlus size={15} /> Schedule</button>}</div><div className="followup-list">{selected.followUps.map((item) => <article key={item.id}><div><strong>{item.purpose}</strong><small>{dateTime(item.dueAt)} · {item.assignedTo.name}</small>{item.outcome && <small>Outcome: {item.outcome}</small>}</div><span className={`lead-stage ${item.status.toLowerCase()}`}>{label(item.status)}</span>{item.status === "OPEN" && options.canReassign && <select className="followup-assignee" aria-label={`Assignee for ${item.purpose}`} value={item.assignedTo.id} onChange={(event) => void assignFollowUp(item, event.target.value)}>{availableAssignees().map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select>}{item.status === "OPEN" && <div className="table-actions"><button className="icon-button compact-icon" title="Complete follow-up" onClick={() => void closeFollowUp(item, "complete")}><Check size={15} /></button><button className="icon-button compact-icon" title="Cancel follow-up" onClick={() => void closeFollowUp(item, "cancel")}><X size={15} /></button></div>}</article>)}{!selected.followUps.length && <p className="empty-profile">No follow-ups scheduled.</p>}</div></section>
        <section className="profile-section"><h3>Add note</h3><form className="note-form" onSubmit={(event) => void addNote(event)}><textarea name="body" required maxLength={1000} placeholder="Record a conversation or context" /><button className="secondary" type="submit"><MessageSquarePlus size={15} /> Add note</button></form></section>
        <section className="profile-section"><h3>Activity</h3><div className="activity-list">{selected.activities.map((item) => <article key={item.id}><span className="activity-dot" /><div><strong>{item.summary}</strong><small>{item.actor?.name ?? "System"} · {dateTime(item.createdAt)}</small></div></article>)}</div></section>
      </div>
      <div className="profile-footer lead-footer"><button className="secondary danger" onClick={() => void toggleArchive()}>{selected.archivedAt ? <RefreshCw size={16} /> : <Archive size={16} />}{selected.archivedAt ? "Reactivate" : "Archive"}</button>{selected.stage !== "CONVERTED" && !selected.archivedAt && <button className="primary" onClick={() => void convert()}><UserCheck size={16} /> Convert to member</button>}</div>
    </div></div>}
    {editOpen && selected && <LeadForm title="Edit lead" options={options} currentUserId={currentUserId} lead={selected} onSubmit={updateLead} onClose={() => setEditOpen(false)} />}
    {followUpOpen && selected && <div className="modal-backdrop nested-modal" role="presentation" onMouseDown={() => setFollowUpOpen(false)}><div className="modal small-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">NEXT ACTION</span><h2>Schedule follow-up</h2></div><button className="icon-button" aria-label="Close" onClick={() => setFollowUpOpen(false)}><X size={20} /></button></div><form onSubmit={(event) => void scheduleFollowUp(event)}><label className="full">Purpose<input name="purpose" required maxLength={500} autoFocus /></label><label>Date and time<input name="dueAt" type="datetime-local" required /></label><label>Assignee<select name="assignedToUserId" defaultValue={currentUserId} disabled={!options.canReassign}>{availableAssignees().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-actions full"><button type="button" className="secondary" onClick={() => setFollowUpOpen(false)}>Cancel</button><button className="primary" type="submit"><CalendarPlus size={16} /> Schedule</button></div></form></div></div>}
  </div>;
}

function LeadForm({ title, options, currentUserId, lead, onSubmit, onClose }: { title: string; options: Options; currentUserId: string; lead?: LeadDetail; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const [formBranch, setFormBranch] = useState(lead?.branchId ?? options.branches[0]?.id ?? "");
  const assignees = options.assignees.filter((item) => item.isOwner || item.branchIds.includes(formBranch));
  return <div className="modal-backdrop nested-modal" role="presentation" onMouseDown={onClose}><div className="modal member-form-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">CRM PROFILE</span><h2>{title}</h2></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button></div><form onSubmit={onSubmit}>
    <label>First name<input name="firstName" required maxLength={100} defaultValue={lead?.firstName} autoFocus /></label><label>Last name<input name="lastName" required maxLength={100} defaultValue={lead?.lastName} /></label>
    <label>Phone<input name="phone" type="tel" required defaultValue={lead?.phone} /></label><label>Email<input name="email" type="email" defaultValue={lead?.email ?? ""} /></label>
    <label>Branch<select name="branchId" value={formBranch} onChange={(event) => setFormBranch(event.target.value)} required>{options.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Source<select name="source" required defaultValue={lead?.source ?? "WALK_IN"}>{sources.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
    <label className="full">Source details<input name="sourceDetail" maxLength={200} defaultValue={lead?.sourceDetail ?? ""} /></label>
    {!lead && <><label>Assignee<select name="assignedToUserId" defaultValue={currentUserId} disabled={!options.canReassign}>{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Initial note<textarea name="note" maxLength={1000} rows={3} /></label></>}
    <div className="form-actions full"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit">{lead ? <Edit3 size={16} /> : <Plus size={16} />}{lead ? "Save changes" : "Create lead"}</button></div>
  </form></div></div>;
}
