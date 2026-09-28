"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Archive,
  Ban,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Snowflake,
  Play,
  UserRoundPlus,
  X,
} from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Branch = { id: string; name: string };
type Plan = { id: string; name: string; durationDays: number; priceMinor: number; isActive: boolean };
type Membership = { id: string; startsAt: string; endsAt: string; status: string; frozenAt: string | null; cancelledAt: string | null; cancellationReason: string | null; plan: Plan; freezes: { id: string; startedAt: string; endedAt: string | null; reason: string | null }[] };
type Member = {
  id: string;
  homeBranchId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  dateOfBirth: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  address: string | null;
  source: string | null;
  status: string;
  joinedAt: string;
  archivedAt: string | null;
  homeBranch: Branch;
  memberships: Membership[];
};
type MemberDetail = Member & {
  notes: { id: string; body: string; createdAt: string; author: { id: string; name: string } }[];
  invoices?: { id: string; invoiceNumber: string; issuedAt: string; dueAt: string; status: string; totalMinor: number; paidMinor: number }[];
};
type ListResponse = { items: Member[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type MutationResponse = { member: Member; warnings: { message: string }[] };

const statuses = ["LEAD", "TRIAL", "ACTIVE", "FROZEN", "EXPIRED", "CANCELLED"];
const dateInput = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";

export function MemberPanel({ branches, canWrite, canSell, canManageMemberships, canReadBilling, onNotice }: { branches: Branch[]; canWrite: boolean; canSell: boolean; canManageMemberships: boolean; canReadBilling: boolean; onNotice: (message: string) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MemberDetail | "new" | null>(null);
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [membershipEditor, setMembershipEditor] = useState<{ mode: "assign" | "renew"; membership?: Membership } | null>(null);
  const [reasonAction, setReasonAction] = useState<{ action: "freeze" | "cancel"; membership: Membership } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query.trim()) params.set("search", query.trim());
    if (status) params.set("status", status);
    if (branchId) params.set("branchId", branchId);
    if (includeArchived) params.set("includeArchived", "true");
    const response = await apiFetch(`/members?${params}`);
    if (response.ok) {
      const body: ListResponse = await response.json();
      setMembers(body.items);
      setPagination(body.pagination);
    } else {
      onNotice(await responseMessage(response, "Could not load members"));
    }
    setLoading(false);
  }, [branchId, includeArchived, onNotice, page, query, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => { setPage(1); }, [query, status, branchId, includeArchived]);
  useEffect(() => { void apiFetch("/membership-plans").then(async (response) => { if (response.ok) setPlans((await response.json()).filter((plan: Plan) => plan.isActive)); }); }, []);

  async function openDetail(memberId: string) {
    const response = await apiFetch(`/members/${memberId}`);
    if (!response.ok) return onNotice(await responseMessage(response, "Could not load member profile"));
    setSelected(await response.json());
  }

  async function saveMember(formData: FormData) {
    const values = Object.fromEntries(formData);
    const isNew = editing === "new";
    const response = await apiFetch(isNew ? "/members" : `/members/${editing?.id}`, {
      method: isNew ? "POST" : "PATCH",
      body: JSON.stringify(values),
    });
    if (!response.ok) return onNotice(await responseMessage(response, `Could not ${isNew ? "create" : "update"} member`));
    const result: MutationResponse = await response.json();
    setEditing(null);
    setSelected(null);
    const warning = result.warnings[0]?.message;
    onNotice(warning ? `Member saved. ${warning}` : `Member ${isNew ? "created" : "updated"} successfully`);
    await load();
    await openDetail(result.member.id);
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    const response = await apiFetch(`/members/${selected.id}/notes`, { method: "POST", body: JSON.stringify({ body }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not add note"));
    form.reset();
    onNotice("Note added");
    await openDetail(selected.id);
  }

  async function changeArchive(member: MemberDetail, archive: boolean) {
    const response = await apiFetch(`/members/${member.id}/${archive ? "archive" : "reactivate"}`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, `Could not ${archive ? "archive" : "reactivate"} member`));
    setSelected(null);
    onNotice(`Member ${archive ? "archived" : "reactivated"}`);
    await load();
  }

  async function saveMembership(data: FormData) {
    if (!selected || !membershipEditor) return;
    const startsAt = String(data.get("startsAt") ?? "");
    const dueAt = String(data.get("dueAt") ?? "");
    const body = { planId: data.get("planId"), ...(startsAt ? { startsAt } : {}), ...(dueAt ? { dueAt } : {}), ...((membershipEditor.mode === "assign") ? { memberId: selected.id } : {}) };
    const path = membershipEditor.mode === "assign" ? "/memberships" : `/memberships/${membershipEditor.membership?.id}/renew`;
    const response = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
    if (!response.ok) return onNotice(await responseMessage(response, `Could not ${membershipEditor.mode} membership`));
    setMembershipEditor(null); onNotice(membershipEditor.mode === "assign" ? "Membership assigned" : "Membership renewed"); await openDetail(selected.id); await load();
  }

  async function submitReason(data: FormData) {
    if (!selected || !reasonAction) return;
    const response = await apiFetch(`/memberships/${reasonAction.membership.id}/${reasonAction.action}`, { method: "POST", body: JSON.stringify({ reason: data.get("reason") }) });
    if (!response.ok) return onNotice(await responseMessage(response, `Could not ${reasonAction.action} membership`));
    setReasonAction(null); onNotice(`Membership ${reasonAction.action === "freeze" ? "frozen" : "cancelled"}`); await openDetail(selected.id); await load();
  }

  async function resumeMembership(membership: Membership) {
    if (!selected) return;
    const response = await apiFetch(`/memberships/${membership.id}/resume`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not resume membership"));
    onNotice("Membership resumed and expiry extended"); await openDetail(selected.id); await load();
  }

  return <section className="workspace member-workspace">
    <div className="section-heading member-heading">
      <div><span className="eyebrow">MEMBER OPERATIONS</span><h2>Member directory</h2><small>{pagination.total} profiles</small></div>
      {canWrite && <button className="primary" onClick={() => setEditing("new")}><UserRoundPlus size={17} /> Add member</button>}
    </div>

    <div className="member-filters">
      <label className="search"><Search size={17} /><input aria-label="Search members" placeholder="Name, phone, email or member number" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select>
      <select aria-label="Filter by branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      <label className="archive-toggle"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Include archived</label>
    </div>

    <div className="table-wrap">
      <table>
        <thead><tr><th>Member</th><th>Contact</th><th>Branch</th><th>Status</th><th>Current plan</th><th><span className="sr-only">View</span></th></tr></thead>
        <tbody>
          {members.map((member) => <tr key={member.id} className={member.archivedAt ? "archived-row" : ""}>
            <td><strong>{member.firstName} {member.lastName}</strong><small>{member.memberNumber}{member.archivedAt ? " · Archived" : ""}</small></td>
            <td>{member.phone}<small>{member.email ?? "No email"}</small></td>
            <td>{member.homeBranch.name}</td>
            <td><span className={`status ${member.status.toLowerCase()}`}>{member.status.toLowerCase()}</span></td>
            <td>{member.memberships[0]?.plan.name ?? "No plan"}</td>
            <td className="row-action"><button className="icon-button compact-icon" title="View member profile" aria-label={`View ${member.firstName} ${member.lastName}`} onClick={() => void openDetail(member.id)}><Eye size={16} /></button></td>
          </tr>)}
          {!loading && !members.length && <tr><td className="empty" colSpan={6}>No members match these filters.</td></tr>}
          {loading && <tr><td className="empty" colSpan={6}>Loading members...</td></tr>}
        </tbody>
      </table>
    </div>

    <div className="pagination">
      <span>Page {pagination.page} of {pagination.totalPages}</span>
      <div><button className="icon-button" title="Previous page" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><button className="icon-button" title="Next page" aria-label="Next page" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div>
    </div>

    {editing && <MemberForm member={editing === "new" ? undefined : editing} branches={branches} onClose={() => setEditing(null)} onSave={saveMember} />}
    {selected && <MemberProfile member={selected} canWrite={canWrite} canSell={canSell} canManageMemberships={canManageMemberships} canReadBilling={canReadBilling} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onArchive={changeArchive} onAddNote={addNote} onAssign={() => setMembershipEditor({ mode: "assign" })} onRenew={(membership) => setMembershipEditor({ mode: "renew", membership })} onFreeze={(membership) => setReasonAction({ action: "freeze", membership })} onResume={resumeMembership} onCancel={(membership) => setReasonAction({ action: "cancel", membership })} />}
    {selected && membershipEditor && <MembershipForm member={selected} plans={plans} editor={membershipEditor} onClose={() => setMembershipEditor(null)} onSave={saveMembership} />}
    {selected && reasonAction && <ReasonForm action={reasonAction.action} onClose={() => setReasonAction(null)} onSave={submitReason} />}
  </section>;
}

function MemberForm({ member, branches, onClose, onSave }: { member?: MemberDetail; branches: Branch[]; onClose: () => void; onSave: (data: FormData) => Promise<void> }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="modal member-form-modal" role="dialog" aria-modal="true" aria-labelledby="member-form-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">{member ? "EDIT PROFILE" : "NEW PROFILE"}</span><h2 id="member-form-title">{member ? `${member.firstName} ${member.lastName}` : "Add member"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <form action={onSave}>
        <label>First name<input required name="firstName" autoFocus defaultValue={member?.firstName} /></label>
        <label>Last name<input required name="lastName" defaultValue={member?.lastName} /></label>
        <label>Phone<input required name="phone" type="tel" defaultValue={member?.phone} /></label>
        <label>Email<input name="email" type="email" defaultValue={member?.email ?? ""} /></label>
        <label>Date of birth<input name="dateOfBirth" type="date" defaultValue={dateInput(member?.dateOfBirth)} /></label>
        <label>Gender<select name="gender" defaultValue={member?.gender ?? ""}><option value="">Not specified</option><option value="M">Male</option><option value="F">Female</option></select></label>
        <label>Height (cm)<input name="heightCm" type="number" min="80" max="250" step="1" defaultValue={member?.heightCm ?? ""} /></label>
        <label>Weight (kg)<input name="weightKg" type="number" min="20" max="400" step="0.1" defaultValue={member?.weightKg ?? ""} /></label>
        <label>Emergency contact<input name="emergencyName" defaultValue={member?.emergencyName ?? ""} /></label>
        <label>Emergency phone<input name="emergencyPhone" type="tel" defaultValue={member?.emergencyPhone ?? ""} /></label>
        <label>Home branch<select required name="branchId" defaultValue={member?.homeBranchId ?? branches[0]?.id}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label>Status<select name="status" defaultValue={member?.status ?? "LEAD"}>{statuses.map((value) => <option key={value} value={value}>{value.toLowerCase()}</option>)}</select></label>
        <label>Joined on<input name="joinedAt" type="date" defaultValue={dateInput(member?.joinedAt) || dateInput(new Date().toISOString())} /></label>
        <label>Source<input name="source" placeholder="Walk-in, referral, campaign..." defaultValue={member?.source ?? ""} /></label>
        <label className="full">Address<textarea name="address" rows={3} defaultValue={member?.address ?? ""} /></label>
        <div className="form-actions full"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit"><Plus size={17} /> {member ? "Save changes" : "Add member"}</button></div>
      </form>
    </div>
  </div>;
}

function MemberProfile({ member, canWrite, canSell, canManageMemberships, canReadBilling, onClose, onEdit, onArchive, onAddNote, onAssign, onRenew, onFreeze, onResume, onCancel }: { member: MemberDetail; canWrite: boolean; canSell: boolean; canManageMemberships: boolean; canReadBilling: boolean; onClose: () => void; onEdit: () => void; onArchive: (member: MemberDetail, archive: boolean) => Promise<void>; onAddNote: (event: FormEvent<HTMLFormElement>) => Promise<void>; onAssign: () => void; onRenew: (membership: Membership) => void; onFreeze: (membership: Membership) => void; onResume: (membership: Membership) => Promise<void>; onCancel: (membership: Membership) => void }) {
  const current = member.memberships.find((membership) => ["ACTIVE", "FROZEN", "PENDING"].includes(membership.status));
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="modal member-profile-modal" role="dialog" aria-modal="true" aria-labelledby="member-profile-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-title"><div><span className="eyebrow">{member.memberNumber}</span><h2 id="member-profile-title">{member.firstName} {member.lastName}</h2></div><div className="profile-actions">{canWrite && !member.archivedAt && <button className="icon-button" title="Edit member" aria-label="Edit member" onClick={onEdit}><Pencil size={17} /></button>}<button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div></div>
      <div className="profile-content">
        {member.archivedAt && <div className="archived-banner">Archived on {new Date(member.archivedAt).toLocaleDateString("en-IN")}</div>}
        <div className="profile-grid">
          <ProfileField label="Status" value={member.status.toLowerCase()} />
          <ProfileField label="Branch" value={member.homeBranch.name} />
          <ProfileField label="Phone" value={member.phone} />
          <ProfileField label="Email" value={member.email ?? "Not provided"} />
          <ProfileField label="Joined" value={new Date(member.joinedAt).toLocaleDateString("en-IN")} />
          <ProfileField label="Date of birth" value={member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString("en-IN") : "Not provided"} />
          <ProfileField label="Gender" value={member.gender === "M" ? "Male" : member.gender === "F" ? "Female" : "Not provided"} />
          <ProfileField label="Height" value={member.heightCm ? `${member.heightCm} cm` : "Not provided"} />
          <ProfileField label="Weight" value={member.weightKg ? `${member.weightKg} kg` : "Not provided"} />
          <ProfileField label="Emergency contact" value={[member.emergencyName, member.emergencyPhone].filter(Boolean).join(" · ") || "Not provided"} />
          <ProfileField label="Source" value={member.source ?? "Not provided"} />
          <ProfileField label="Address" value={member.address ?? "Not provided"} wide />
        </div>
        <div className="profile-section"><div className="profile-section-heading"><h3>Membership history</h3>{canSell && !member.archivedAt && !current && <button className="secondary compact" onClick={onAssign}><CalendarPlus size={15} /> Assign plan</button>}</div>{member.memberships.length ? member.memberships.map((membership) => <div className="timeline-row membership-row" key={membership.id}><div><strong>{membership.plan.name}</strong><small>{new Date(membership.startsAt).toLocaleDateString("en-IN")} to {new Date(membership.endsAt).toLocaleDateString("en-IN")}</small>{membership.cancellationReason && <small>Reason: {membership.cancellationReason}</small>}</div><div className="membership-actions"><span className={`status ${membership.status.toLowerCase()}`}>{membership.status.toLowerCase()}</span>{canSell && membership === member.memberships[0] && <button className="icon-button compact-icon" title="Renew membership" onClick={() => onRenew(membership)}><RotateCcw size={15} /></button>}{canManageMemberships && membership.status === "ACTIVE" && <button className="icon-button compact-icon" title="Freeze membership" onClick={() => onFreeze(membership)}><Snowflake size={15} /></button>}{canManageMemberships && membership.status === "FROZEN" && <button className="icon-button compact-icon" title="Resume membership" onClick={() => void onResume(membership)}><Play size={15} /></button>}{canManageMemberships && ["ACTIVE", "FROZEN", "PENDING"].includes(membership.status) && <button className="icon-button compact-icon danger" title="Cancel membership" onClick={() => onCancel(membership)}><Ban size={15} /></button>}</div></div>) : <p className="empty-profile">No memberships recorded.</p>}</div>
        {canReadBilling && <div className="profile-section"><h3>Billing history</h3>{member.invoices?.map((invoice) => { const balance = invoice.totalMinor - invoice.paidMinor; const today = new Date(); today.setHours(0, 0, 0, 0); const effectiveStatus = ["OPEN", "PARTIALLY_PAID"].includes(invoice.status) && new Date(invoice.dueAt) < today ? "OVERDUE" : invoice.status; return <div className="timeline-row" key={invoice.id}><div><strong>{invoice.invoiceNumber}</strong><small>{new Date(invoice.issuedAt).toLocaleDateString("en-IN")} · Total ₹{(invoice.totalMinor / 100).toLocaleString("en-IN")} · Balance ₹{(balance / 100).toLocaleString("en-IN")}</small></div><span className={`status ${effectiveStatus.toLowerCase()}`}>{effectiveStatus.toLowerCase().replaceAll("_", " ")}</span></div>; })}{!member.invoices?.length && <p className="empty-profile">No invoices recorded.</p>}</div>}
        <div className="profile-section"><h3>Staff notes</h3>{canWrite && !member.archivedAt && <form className="note-form" onSubmit={(event) => void onAddNote(event)}><textarea required name="body" rows={3} placeholder="Add an internal note" /><button className="primary" type="submit"><StickyNote size={16} /> Add note</button></form>}<div className="notes-list">{member.notes.map((note) => <article key={note.id}><p>{note.body}</p><small>{note.author.name} · {new Date(note.createdAt).toLocaleString("en-IN")}</small></article>)}{!member.notes.length && <p className="empty-profile">No notes yet.</p>}</div></div>
      </div>
      {canWrite && <div className="profile-footer">{member.archivedAt ? <button className="secondary" onClick={() => void onArchive(member, false)}><RotateCcw size={16} /> Reactivate member</button> : <button className="secondary danger" onClick={() => void onArchive(member, true)}><Archive size={16} /> Archive member</button>}</div>}
    </div>
  </div>;
}

function MembershipForm({ member, plans, editor, onClose, onSave }: { member: MemberDetail; plans: Plan[]; editor: { mode: "assign" | "renew"; membership?: Membership }; onClose: () => void; onSave: (data: FormData) => Promise<void> }) {
  const defaultStart = editor.mode === "assign" ? dateInput(new Date().toISOString()) : "";
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [dueAt, setDueAt] = useState(defaultStart);
  return <div className="modal-backdrop nested-modal" role="presentation" onMouseDown={onClose}><div className="modal small-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">MEMBERSHIP</span><h2>{editor.mode === "assign" ? "Assign plan" : "Renew membership"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><form action={onSave}><label className="full">Plan<select required name="planId" defaultValue={editor.membership?.plan.id ?? plans[0]?.id}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.durationDays} days · ₹{(plan.priceMinor / 100).toLocaleString("en-IN")}</option>)}</select></label><label>Start date<input required={editor.mode === "assign"} name="startsAt" type="date" value={startsAt} onChange={(event) => { const next = event.target.value; if (!dueAt || dueAt === startsAt) setDueAt(next); setStartsAt(next); }} /></label><label>Invoice due date<input name="dueAt" type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><div className="form-actions full"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" type="submit"><CalendarPlus size={16} /> {editor.mode === "assign" ? "Assign and invoice" : "Renew and invoice"}</button></div></form></div></div>;
}

function ReasonForm({ action, onClose, onSave }: { action: "freeze" | "cancel"; onClose: () => void; onSave: (data: FormData) => Promise<void> }) {
  return <div className="modal-backdrop nested-modal" role="presentation" onMouseDown={onClose}><div className="modal small-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">MEMBERSHIP</span><h2>{action === "freeze" ? "Freeze membership" : "Cancel membership"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><form action={onSave}><label className="full">Reason<textarea name="reason" rows={3} placeholder="Optional internal reason" /></label><div className="form-actions full"><button type="button" className="secondary" onClick={onClose}>Back</button><button className={`primary${action === "cancel" ? " destructive" : ""}`} type="submit">{action === "freeze" ? <Snowflake size={16} /> : <Ban size={16} />} Confirm {action}</button></div></form></div></div>;
}

function ProfileField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "profile-field wide" : "profile-field"}><span>{label}</span><strong>{value}</strong></div>;
}
