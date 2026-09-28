"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, ShieldCheck, UserPlus, UserX, X } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Staff = { id: string; name: string; email: string; status: string; lastLoginAt?: string; roles: { role: { id: string; name: string } }[]; branches: { branch: { id: string; name: string } }[] };
type Option = { id: string; name: string };

export function StaffPanel({ currentUserId, onNotice }: { currentUserId: string; onNotice: (message: string) => void }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState("");

  const load = useCallback(async () => {
    const [staffResponse, optionsResponse] = await Promise.all([apiFetch("/staff"), apiFetch("/staff/options")]);
    if (staffResponse.ok) setStaff(await staffResponse.json());
    if (optionsResponse.ok) {
      const options = await optionsResponse.json(); setRoles(options.roles); setBranches(options.branches);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function invite(formData: FormData) {
    const response = await apiFetch("/staff/invitations", { method: "POST", body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), roleId: formData.get("roleId"), branchIds: formData.getAll("branchIds") }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not create invitation"));
    const result = await response.json(); setInvitationUrl(result.invitationUrl); onNotice("Invitation created. Share the one-time link securely.");
  }

  async function disable(userId: string) {
    const response = await apiFetch(`/staff/${userId}/disable`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not disable staff member"));
    onNotice("Staff account disabled and active sessions revoked"); await load();
  }

  return <section className="workspace staff-workspace">
    <div className="section-heading"><div><span className="eyebrow">ACCESS CONTROL</span><h2>Staff & roles</h2></div><button className="primary" onClick={() => { setInvitationUrl(""); setOpen(true); }}><UserPlus size={17} /> Invite staff</button></div>
    <div className="table-wrap"><table><thead><tr><th>Staff member</th><th>Role</th><th>Branches</th><th>Status</th><th>Last login</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
      {staff.map((person) => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.email}</small></td><td>{person.roles.map(({ role }) => role.name).join(", ")}</td><td>{person.branches.map(({ branch }) => branch.name).join(", ") || "None"}</td><td><span className={`status ${person.status.toLowerCase()}`}>{person.status.toLowerCase()}</span></td><td>{person.lastLoginAt ? new Date(person.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never"}</td><td className="row-action">{person.id !== currentUserId && person.status === "ACTIVE" && <button className="icon-button danger" title="Disable account" onClick={() => void disable(person.id)}><UserX size={16} /></button>}</td></tr>)}
    </tbody></table></div>
    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(false)}><div className="modal small-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">ONE-TIME ACCESS</span><h2>Invite staff</h2></div><button className="icon-button" onClick={() => setOpen(false)}><X size={20} /></button></div>
      {invitationUrl ? <div className="invite-result"><ShieldCheck size={28} /><h3>Invitation ready</h3><p>This link expires in 72 hours and can be used once.</p><div className="copy-row"><input readOnly value={invitationUrl} /><button className="icon-button" title="Copy invitation link" onClick={() => void navigator.clipboard.writeText(invitationUrl)}><Copy size={17} /></button></div><button className="primary" onClick={() => setOpen(false)}>Done</button></div> : <form action={invite}><label>Name<input name="name" required autoFocus /></label><label>Email<input name="email" type="email" required /></label><label className="full">Role<select name="roleId" required defaultValue={roles[0]?.id}>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><fieldset className="full"><legend>Branch access</legend>{branches.map((branch) => <label className="check-option" key={branch.id}><input type="checkbox" name="branchIds" value={branch.id} defaultChecked />{branch.name}</label>)}</fieldset><div className="form-actions full"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary"><UserPlus size={17} /> Create invitation</button></div></form>}
    </div></div>}
  </section>;
}

