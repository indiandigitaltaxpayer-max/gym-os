"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Power, X } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Plan = { id: string; name: string; description: string | null; durationDays: number; priceMinor: number; taxRateBps: number; isActive: boolean };
type Expiring = { id: string; endsAt: string; plan: Plan; member: { id: string; memberNumber: string; firstName: string; lastName: string; homeBranch: { name: string } } };
const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);

export function MembershipPanel({ canConfigure, onNotice }: { canConfigure: boolean; onNotice: (message: string) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expiring, setExpiring] = useState<Expiring[]>([]);
  const [days, setDays] = useState(30);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);

  const load = useCallback(async () => {
    const [plansResponse, expiringResponse] = await Promise.all([apiFetch("/membership-plans"), apiFetch(`/memberships/expiring?days=${days}`)]);
    if (plansResponse.ok) setPlans(await plansResponse.json()); else onNotice(await responseMessage(plansResponse, "Could not load membership plans"));
    if (expiringResponse.ok) setExpiring(await expiringResponse.json()); else onNotice(await responseMessage(expiringResponse, "Could not load expiring memberships"));
  }, [days, onNotice]);
  useEffect(() => { void load(); }, [load]);

  async function savePlan(data: FormData) {
    const isNew = editing === "new";
    const body = {
      name: data.get("name"), description: data.get("description"), durationDays: Number(data.get("durationDays")),
      priceMinor: Math.round(Number(data.get("price")) * 100), taxRateBps: Math.round(Number(data.get("taxRate")) * 100),
    };
    const response = await apiFetch(isNew ? "/membership-plans" : `/membership-plans/${editing?.id}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not save membership plan"));
    setEditing(null); onNotice(`Plan ${isNew ? "created" : "updated"}`); await load();
  }

  async function deactivate(plan: Plan) {
    const response = await apiFetch(`/membership-plans/${plan.id}/deactivate`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not deactivate plan"));
    onNotice("Plan deactivated; existing memberships were preserved"); await load();
  }

  return <div className="membership-workspace">
    <section className="workspace">
      <div className="section-heading"><div><span className="eyebrow">RENEWAL PIPELINE</span><h2>Expiring memberships</h2></div><select aria-label="Expiry window" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Next 7 days</option><option value={15}>Next 15 days</option><option value={30}>Next 30 days</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Member</th><th>Plan</th><th>Branch</th><th>Expires</th></tr></thead><tbody>{expiring.map((item) => <tr key={item.id}><td><strong>{item.member.firstName} {item.member.lastName}</strong><small>{item.member.memberNumber}</small></td><td>{item.plan.name}</td><td>{item.member.homeBranch.name}</td><td>{new Date(item.endsAt).toLocaleDateString("en-IN")}</td></tr>)}{!expiring.length && <tr><td colSpan={4} className="empty">No memberships expire in this window.</td></tr>}</tbody></table></div>
    </section>
    <section className="workspace plans-workspace">
      <div className="section-heading"><div><span className="eyebrow">CATALOGUE</span><h2>Membership plans</h2></div>{canConfigure && <button className="primary" onClick={() => setEditing("new")}><Plus size={17} /> Add plan</button>}</div>
      <div className="table-wrap"><table><thead><tr><th>Plan</th><th>Duration</th><th>Price</th><th>Tax</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{plans.map((plan) => <tr key={plan.id}><td><strong>{plan.name}</strong><small>{plan.description ?? "No description"}</small></td><td>{plan.durationDays} days</td><td>{money(plan.priceMinor)}</td><td>{plan.taxRateBps / 100}%</td><td><span className={`status ${plan.isActive ? "active" : "disabled"}`}>{plan.isActive ? "active" : "inactive"}</span></td><td className="row-action"><div className="table-actions">{canConfigure && <button className="icon-button compact-icon" title="Edit plan" onClick={() => setEditing(plan)}><Pencil size={15} /></button>}{canConfigure && plan.isActive && <button className="icon-button compact-icon danger" title="Deactivate plan" onClick={() => void deactivate(plan)}><Power size={15} /></button>}</div></td></tr>)}</tbody></table></div>
    </section>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditing(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">PLAN CATALOGUE</span><h2>{editing === "new" ? "Add plan" : "Edit plan"}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Close"><X size={20} /></button></div><form action={savePlan}><label>Plan name<input required name="name" defaultValue={editing === "new" ? "" : editing.name} /></label><label>Duration (days)<input required type="number" min="1" max="3650" name="durationDays" defaultValue={editing === "new" ? 30 : editing.durationDays} /></label><label>Price (₹)<input required type="number" min="0" step="0.01" name="price" defaultValue={editing === "new" ? "" : editing.priceMinor / 100} /></label><label>Tax (%)<input required type="number" min="0" max="100" step="0.01" name="taxRate" defaultValue={editing === "new" ? 0 : editing.taxRateBps / 100} /></label><label className="full">Description<textarea name="description" rows={3} defaultValue={editing === "new" ? "" : editing.description ?? ""} /></label><div className="form-actions full"><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button><button className="primary" type="submit"><CalendarClock size={16} /> Save plan</button></div></form></div></div>}
  </div>;
}
