"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CreditCard,
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Target,
  UserRoundPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";
import { LoginScreen } from "./login-screen";
import { StaffPanel } from "./staff-panel";
import { MemberPanel } from "./member-panel";
import { MembershipPanel } from "./membership-panel";
import { BillingPanel } from "./billing-panel";
import { AttendancePanel } from "./attendance-panel";
import { LeadsPanel } from "./leads-panel";
import { NotificationsPanel } from "./notifications-panel";
import { ReportsPanel } from "./reports-panel";

type Setup = { name: string; currency: string; branches: { id: string; name: string }[]; plans: { id: string; name: string; priceMinor: number }[] };
type Stats = { activeMembers: number; checkInsToday: number; outstandingMinor: number | null; revenueThisMonthMinor: number | null; recentCheckIns: { id: string; checkedInAt: string; member: { firstName: string; lastName: string; memberNumber: string }; branch: { name: string } }[]; dueFollowUps: { id: string; dueAt: string; purpose: string; lead: { id: string; firstName: string; lastName: string; phone: string; stage: string } }[] };
type Member = { id: string; homeBranchId: string; memberNumber: string; firstName: string; lastName: string; phone: string; status: string; memberships: { endsAt: string; plan: { name: string } }[] };
type AuthUser = { userId: string; name: string; email: string; roles: string[]; permissions: string[]; branchIds: string[] };

const money = (minor = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);

export function Dashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<"overview" | "members" | "memberships" | "billing" | "attendance" | "leads" | "notifications" | "reports" | "staff">("overview");
  const [invitationToken] = useState(() => typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("invite") ?? undefined);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const authenticate = useCallback(async () => {
    const response = await apiFetch("/auth/me");
    setUser(response.ok ? await response.json() : null);
    setAuthReady(true);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const [setupResponse, statsResponse, membersResponse] = await Promise.all([
      apiFetch("/setup"),
      apiFetch("/dashboard"),
      apiFetch("/members"),
    ]);
    if (setupResponse.ok) setSetup(await setupResponse.json());
    if (statsResponse.ok) setStats(await statsResponse.json());
    if (membersResponse.ok) setMembers((await membersResponse.json()).items);
  }, [user]);

  useEffect(() => { void authenticate(); }, [authenticate]);
  useEffect(() => { void load(); }, [load]);

  async function addMember(formData: FormData) {
    const response = await apiFetch("/members", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    if (!response.ok) {
      setNotice(await responseMessage(response, "Could not add member"));
      return;
    }
    setOpen(false);
    setNotice("Member added successfully");
    await load();
  }

  async function checkIn(member: Member) {
    const response = await apiFetch("/check-ins", {
      method: "POST",
      body: JSON.stringify({ memberId: member.id, branchId: member.homeBranchId }),
    });
    if (!response.ok) {
      setNotice(await responseMessage(response, "Check-in was declined"));
      return;
    }
    setNotice(`${member.firstName} checked in`);
    await load();
  }

  const filtered = members.filter((member) => `${member.firstName} ${member.lastName} ${member.phone}`.toLowerCase().includes(query.toLowerCase()));
  const can = (permission: string) => user?.permissions.includes(permission) ?? false;

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }, false);
    setUser(null); setSetup(null); setStats(null); setMembers([]);
  }

  if (!authReady) return <div className="auth-loading">Opening secure workspace...</div>;
  if (!user) return <LoginScreen invitationToken={invitationToken} onAuthenticated={authenticate} />;

  return (
    <div className="shell">
      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <div className="brand"><span className="brand-mark">P</span><span>Pulse</span></div>
        <nav aria-label="Primary navigation">
          <button className={view === "overview" ? "active" : ""} onClick={() => { setView("overview"); setNavOpen(false); }}><LayoutDashboard size={18} /> Overview</button>
          <button className={view === "members" ? "active" : ""} onClick={() => { setView("members"); setNavOpen(false); }}><Users size={18} /> Members</button>
          <button className={view === "memberships" ? "active" : ""} onClick={() => { setView("memberships"); setNavOpen(false); }}><CalendarDays size={18} /> Memberships</button>
          {(can("payment.read") || can("payment.write")) && <button className={view === "billing" ? "active" : ""} onClick={() => { setView("billing"); setNavOpen(false); }}><WalletCards size={18} /> Billing</button>}
          {can("attendance.read") && <button className={view === "attendance" ? "active" : ""} onClick={() => { setView("attendance"); setNavOpen(false); }}><Activity size={18} /> Attendance</button>}
          {can("lead.read") && <button className={view === "leads" ? "active" : ""} onClick={() => { setView("leads"); setNavOpen(false); }}><Target size={18} /> Leads</button>}
          {can("notification.read") && <button className={view === "notifications" ? "active" : ""} onClick={() => { setView("notifications"); setNavOpen(false); }}><Bell size={18} /> Notifications</button>}
          {(can("report.operations.read") || can("report.finance.read")) && <button className={view === "reports" ? "active" : ""} onClick={() => { setView("reports"); setNavOpen(false); }}><ChartNoAxesCombined size={18} /> Reports</button>}
          {(can("staff.manage") || can("staff.manage.limited")) && <button className={view === "staff" ? "active" : ""} onClick={() => { setView("staff"); setNavOpen(false); }}><UserRoundPlus size={18} /> Staff</button>}
        </nav>
        <button className="settings" onClick={() => void logout()}><LogOut size={18} /> Sign out</button>
      </aside>
      {navOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}

      <main>
        <header>
          <button className="icon-button menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={20} /></button>
          <div><span className="eyebrow">WORKSPACE</span><h1>{setup?.name ?? "Gym operations"}</h1></div>
          <div className="header-actions"><div className="signed-in"><strong>{user.name}</strong><small>{user.roles.join(", ")}</small></div>{view === "overview" && can("member.write") && <button className="primary" onClick={() => setOpen(true)}><UserRoundPlus size={17} /> Add member</button>}</div>
        </header>

        {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<X size={15} /></button>}

        {view === "overview" ? <>
        <section className="summary" id="overview">
          <article><div className="metric-icon green"><Users size={19} /></div><span>Active members</span><strong>{stats?.activeMembers ?? 0}</strong><small><ArrowUpRight size={13} /> Current memberships</small></article>
          <article><div className="metric-icon coral"><Activity size={19} /></div><span>Check-ins today</span><strong>{stats?.checkInsToday ?? 0}</strong><small>Across all branches</small></article>
          {can("finance.read") && <article><div className="metric-icon blue"><CreditCard size={19} /></div><span>Revenue this month</span><strong>{money(stats?.revenueThisMonthMinor ?? 0)}</strong><small>Captured payments</small></article>}
          {can("finance.read") && <article><div className="metric-icon amber"><WalletCards size={19} /></div><span>Outstanding</span><strong>{money(stats?.outstandingMinor ?? 0)}</strong><small>Open invoice balance</small></article>}
        </section>

        <section className="workspace" id="members">
          <div className="section-heading">
            <div><span className="eyebrow">MEMBER DIRECTORY</span><h2>Members</h2></div>
            <label className="search"><Search size={17} /><input aria-label="Search members" placeholder="Search name or phone" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Member</th><th>Contact</th><th>Plan</th><th>Status</th><th>Valid until</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {filtered.map((member) => {
                  const membership = member.memberships[0];
                  return <tr key={member.id}>
                    <td><strong>{member.firstName} {member.lastName}</strong><small>{member.memberNumber}</small></td>
                    <td>{member.phone}</td>
                    <td>{membership?.plan.name ?? "No plan"}</td>
                    <td><span className={`status ${member.status.toLowerCase()}`}>{member.status.toLowerCase()}</span></td>
                    <td>{membership ? new Date(membership.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"}</td>
                    <td className="row-action">{member.status === "ACTIVE" ? can("checkin.create") && <button className="secondary compact" onClick={() => void checkIn(member)}>Check in</button> : can("membership.sell") && <button className="secondary compact" onClick={() => setView("members")}>Manage</button>}</td>
                  </tr>;
                })}
                {!filtered.length && <tr><td className="empty" colSpan={6}>No members yet. Add the first member to begin.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="recent" id="attendance">
          <div className="section-heading"><div><span className="eyebrow">LIVE FLOOR</span><h2>Recent check-ins</h2></div></div>
          <div className="checkin-list">
            {stats?.recentCheckIns.map((entry) => <div className="checkin" key={entry.id}><span className="avatar">{entry.member.firstName[0]}{entry.member.lastName[0]}</span><div><strong>{entry.member.firstName} {entry.member.lastName}</strong><small>{entry.member.memberNumber} · {entry.branch.name}</small></div><time>{new Date(entry.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time></div>)}
            {!stats?.recentCheckIns.length && <p className="empty-block">Today’s check-ins will appear here.</p>}
          </div>
        </section>
        {can("lead.read") && <section className="recent due-followups"><div className="section-heading"><div><span className="eyebrow">MY CRM TASKS</span><h2>Due follow-ups</h2></div><button className="secondary compact" onClick={() => setView("leads")}>Open leads</button></div><div className="checkin-list">{stats?.dueFollowUps.map((item) => <div className="checkin" key={item.id}><span className="avatar"><Target size={15} /></span><div><strong>{item.lead.firstName} {item.lead.lastName}</strong><small>{item.purpose} · {item.lead.phone}</small></div><time className={new Date(item.dueAt) < new Date() ? "overdue-text" : ""}>{new Date(item.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div>)}{!stats?.dueFollowUps.length && <p className="empty-block">No follow-ups are due today.</p>}</div></section>}
        </> : view === "members" ? <MemberPanel branches={setup?.branches ?? []} canWrite={can("member.write")} canSell={can("membership.sell")} canManageMemberships={user.roles.some((role) => role === "Owner" || role === "Manager")} canReadBilling={can("payment.read")} onNotice={setNotice} /> : view === "memberships" ? <MembershipPanel canConfigure={can("gym.configure")} onNotice={setNotice} /> : view === "billing" ? <BillingPanel branches={setup?.branches ?? []} currency={setup?.currency ?? "INR"} canWrite={can("payment.write")} canViewSummary={can("finance.read")} canVoid={user.roles.includes("Owner")} canReverse={user.roles.some((role) => role === "Owner" || role === "Accountant")} onNotice={setNotice} /> : view === "attendance" ? <AttendancePanel branches={setup?.branches ?? []} onNotice={setNotice} onAttendanceChanged={load} /> : view === "leads" ? <LeadsPanel currentUserId={user.userId} onNotice={setNotice} onLeadsChanged={load} /> : view === "notifications" ? <NotificationsPanel branches={setup?.branches ?? []} onNotice={setNotice} /> : view === "reports" ? <ReportsPanel branches={setup?.branches ?? []} currency={setup?.currency ?? "INR"} canOperations={can("report.operations.read")} canFinance={can("report.finance.read")} onNotice={setNotice} /> : <StaffPanel currentUserId={user.userId} onNotice={setNotice} />}
      </main>

      {open && <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-title"><div><span className="eyebrow">NEW PROFILE</span><h2 id="add-member-title">Add member</h2></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button></div>
          <form action={addMember}>
            <label>First name<input required name="firstName" autoFocus /></label>
            <label>Last name<input required name="lastName" /></label>
            <label>Phone<input required name="phone" type="tel" /></label>
            <label>Email<input name="email" type="email" /></label>
            <label className="full">Home branch<select required name="branchId" defaultValue={setup?.branches[0]?.id}>{setup?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
            <div className="form-actions full"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button className="primary" type="submit"><Plus size={17} /> Add member</button></div>
          </form>
        </div>
      </div>}

    </div>
  );
}
