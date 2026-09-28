"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarRange, Download, LoaderCircle, Target, Users, WalletCards } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Branch = { id: string; name: string };
type ReportTab = "members" | "revenue" | "attendance" | "leads";
type Range = { from: string; to: string; branchId: string | null; timezone: string };
type MembersReport = { range: Range; totalCurrent: number; newMembers: number; renewals: number; expiringCount: number; archived: number; byStatus: Record<string, number>; expiring: { id: string; endsAt: string; member: { memberNumber: string; firstName: string; lastName: string; phone: string }; plan: { name: string } }[] };
type RevenueReport = { range: Range; invoicedMinor: number; collectedMinor: number; outstandingMinor: number; overdueMinor: number; invoiceCount: number; paymentCount: number; overdueCount: number; byMethod: Record<string, number>; trend: { label: string; valueMinor: number }[]; invoices: { id: string; invoiceNumber: string; issuedAt: string; dueAt: string; totalMinor: number; paidMinor: number; status: string; member: { firstName: string; lastName: string; memberNumber: string }; branch: { name: string } }[] };
type AttendanceReport = { range: Range; totalCheckIns: number; uniqueMembers: number; averagePerDay: number; bySource: Record<string, number>; trend: { label: string; count: number }[]; topMembers: { memberId: string; memberNumber: string; name: string; visits: number }[] };
type LeadsReport = { range: Range; total: number; converted: number; lost: number; active: number; conversionRate: number; byStage: Record<string, number>; bySource: Record<string, number>; followUps: { due: number; completed: number; open: number; overdue: number } };

const labels: Record<string, string> = {
  ACTIVE: "Active", TRIAL: "Trial", FROZEN: "Frozen", EXPIRED: "Expired", CANCELLED: "Cancelled", LEAD: "Lead",
  NEW: "New", CONTACTED: "Contacted", TRIAL_SCHEDULED: "Trial scheduled", TRIAL_COMPLETED: "Trial completed", CONVERTED: "Converted", LOST: "Lost",
  WALK_IN: "Walk-in", PHONE: "Phone", WEBSITE: "Website", REFERRAL: "Referral", SOCIAL_MEDIA: "Social media", OTHER: "Other",
  FRONT_DESK: "Front desk", QR: "QR", CASH: "Cash", CARD: "Card", UPI: "UPI", BANK_TRANSFER: "Bank transfer", ONLINE: "Online",
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function ReportsPanel({ branches, currency, canOperations, canFinance, onNotice }: { branches: Branch[]; currency: string; canOperations: boolean; canFinance: boolean; onNotice: (message: string) => void }) {
  const now = new Date();
  const [tab, setTab] = useState<ReportTab>(canOperations ? "members" : "revenue");
  const [from, setFrom] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [to, setTo] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`);
  const [branchId, setBranchId] = useState("");
  const [data, setData] = useState<MembersReport | RevenueReport | AttendanceReport | LeadsReport | null>(null);
  const [loadedTab, setLoadedTab] = useState<ReportTab | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const value = new URLSearchParams({ from, to });
    if (branchId) value.set("branchId", branchId);
    return value.toString();
  }, [branchId, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await apiFetch(`/reports/${tab}?${params}`);
    if (!response.ok) {
      setError(await responseMessage(response, "Could not load this report"));
      setData(null);
      setLoadedTab(null);
    } else {
      setData(await response.json());
      setLoadedTab(tab);
    }
    setLoading(false);
  }, [params, tab]);

  useEffect(() => { void load(); }, [load]);

  async function download() {
    setDownloading(true);
    const response = await apiFetch(`/reports/${tab}/export?${params}`);
    if (!response.ok) {
      onNotice(await responseMessage(response, "Could not export this report"));
      setDownloading(false);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `${tab}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
    onNotice("CSV export downloaded");
  }

  const tabs = [
    canOperations && { id: "members" as const, label: "Members", icon: Users },
    canFinance && { id: "revenue" as const, label: "Revenue", icon: WalletCards },
    canOperations && { id: "attendance" as const, label: "Attendance", icon: Activity },
    canOperations && { id: "leads" as const, label: "Leads", icon: Target },
  ].filter(Boolean) as { id: ReportTab; label: string; icon: typeof Users }[];

  return <div className="reports-page">
    <section className="reports-topbar">
      <div><span className="eyebrow">BUSINESS INTELLIGENCE</span><h2>Reports</h2><small>Operational and financial performance</small></div>
      <div className="report-filters">
        <label><span>From</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>To</span><input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <label><span>Branch</span><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All accessible branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      </div>
      <button className="secondary" onClick={() => void download()} disabled={loading || downloading}><Download size={16} /> {downloading ? "Preparing" : "Export CSV"}</button>
    </section>

    <div className="report-tabs" role="tablist" aria-label="Report category">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => { setData(null); setLoadedTab(null); setTab(id); }}><Icon size={16} />{label}</button>)}
    </div>

    {loading ? <div className="report-state"><LoaderCircle className="spin" size={22} /> Loading report</div> : error ? <div className="report-state error-state"><strong>Report unavailable</strong><span>{error}</span><button className="secondary compact" onClick={() => void load()}>Try again</button></div> : loadedTab !== tab ? <div className="report-state"><LoaderCircle className="spin" size={22} /> Loading report</div> : data ? <ReportBody tab={tab} data={data} currency={currency} /> : null}
  </div>;
}

function ReportBody({ tab, data, currency }: { tab: ReportTab; data: MembersReport | RevenueReport | AttendanceReport | LeadsReport; currency: string }) {
  if (tab === "members") return <MembersBody data={data as MembersReport} />;
  if (tab === "revenue") return <RevenueBody data={data as RevenueReport} currency={currency} />;
  if (tab === "attendance") return <AttendanceBody data={data as AttendanceReport} />;
  return <LeadsBody data={data as LeadsReport} />;
}

function MembersBody({ data }: { data: MembersReport }) {
  return <>
    <MetricStrip items={[{ label: "Current members", value: data.totalCurrent, note: "Non-archived profiles" }, { label: "New members", value: data.newMembers, note: "Joined in period" }, { label: "Renewals", value: data.renewals, note: "Repeat memberships" }, { label: "Expiring", value: data.expiringCount, note: "Within selected dates" }]} />
    <div className="report-grid">
      <ReportDistribution title="Member status" eyebrow="CURRENT MIX" values={data.byStatus} />
      <section className="report-section"><div className="section-heading"><div><span className="eyebrow">RENEWAL WATCH</span><h3>Expiring memberships</h3></div><small>{data.archived} archived profiles excluded</small></div><div className="table-wrap"><table><thead><tr><th>Member</th><th>Plan</th><th>Phone</th><th>Expires</th></tr></thead><tbody>{data.expiring.map((item) => <tr key={item.id}><td><strong>{item.member.firstName} {item.member.lastName}</strong><small>{item.member.memberNumber}</small></td><td>{item.plan.name}</td><td>{item.member.phone}</td><td>{formatDate(item.endsAt)}</td></tr>)}{!data.expiring.length && <tr><td colSpan={4} className="empty">No memberships expire in this period.</td></tr>}</tbody></table></div></section>
    </div>
  </>;
}

function RevenueBody({ data, currency }: { data: RevenueReport; currency: string }) {
  const money = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
  return <>
    <MetricStrip items={[{ label: "Invoiced", value: money(data.invoicedMinor), note: `${data.invoiceCount} invoices` }, { label: "Collected", value: money(data.collectedMinor), note: `${data.paymentCount} payments` }, { label: "Outstanding", value: money(data.outstandingMinor), note: "Selected invoices" }, { label: "Overdue", value: money(data.overdueMinor), note: `${data.overdueCount} invoices` }]} />
    <div className="report-grid equal">
      <TrendChart title="Collection trend" eyebrow="CASH FLOW" values={data.trend.map((item) => ({ label: item.label, value: item.valueMinor, display: money(item.valueMinor) }))} />
      <ReportDistribution title="Payment methods" eyebrow="COLLECTION MIX" values={data.byMethod} formatter={money} />
    </div>
    <section className="report-section"><div className="section-heading"><div><span className="eyebrow">RECONCILIATION</span><h3>Invoices in period</h3></div></div><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Member</th><th>Branch</th><th>Issued</th><th>Status</th><th className="number">Balance</th></tr></thead><tbody>{data.invoices.map((item) => <tr key={item.id}><td><strong>{item.invoiceNumber}</strong></td><td><strong>{item.member.firstName} {item.member.lastName}</strong><small>{item.member.memberNumber}</small></td><td>{item.branch.name}</td><td>{formatDate(item.issuedAt)}</td><td><span className={`status ${item.status.toLowerCase()}`}>{labels[item.status] ?? item.status}</span></td><td className="number">{money(item.totalMinor - item.paidMinor)}</td></tr>)}{!data.invoices.length && <tr><td colSpan={6} className="empty">No invoices were issued in this period.</td></tr>}</tbody></table></div></section>
  </>;
}

function AttendanceBody({ data }: { data: AttendanceReport }) {
  return <>
    <MetricStrip items={[{ label: "Check-ins", value: data.totalCheckIns, note: "Total visits" }, { label: "Unique members", value: data.uniqueMembers, note: "Distinct visitors" }, { label: "Daily average", value: data.averagePerDay, note: "Across selected period" }, { label: "QR check-ins", value: data.bySource.QR ?? 0, note: `${data.bySource.FRONT_DESK ?? 0} front desk` }]} />
    <div className="report-grid equal">
      <TrendChart title="Attendance trend" eyebrow="VISIT PATTERN" values={data.trend.map((item) => ({ label: item.label, value: item.count, display: `${item.count} visits` }))} />
      <section className="report-section"><div className="section-heading"><div><span className="eyebrow">ENGAGEMENT</span><h3>Most active members</h3></div></div><div className="rank-list">{data.topMembers.map((item, index) => <div key={item.memberId}><span>{index + 1}</span><div><strong>{item.name}</strong><small>{item.memberNumber}</small></div><b>{item.visits}</b></div>)}{!data.topMembers.length && <p className="empty-block">No check-ins in this period.</p>}</div></section>
    </div>
  </>;
}

function LeadsBody({ data }: { data: LeadsReport }) {
  return <>
    <MetricStrip items={[{ label: "Leads created", value: data.total, note: "Selected period" }, { label: "Active pipeline", value: data.active, note: "Open opportunities" }, { label: "Converted", value: data.converted, note: `${data.conversionRate}% conversion` }, { label: "Overdue follow-ups", value: data.followUps.overdue, note: `${data.followUps.completed} completed` }]} />
    <div className="report-grid equal"><ReportDistribution title="Pipeline stages" eyebrow="CONVERSION" values={data.byStage} /><ReportDistribution title="Lead sources" eyebrow="ACQUISITION" values={data.bySource} /></div>
    <section className="report-section followup-report"><div><span className="eyebrow">FOLLOW-UP HEALTH</span><h3>Tasks due in period</h3></div><dl><div><dt>Due</dt><dd>{data.followUps.due}</dd></div><div><dt>Open</dt><dd>{data.followUps.open}</dd></div><div><dt>Completed</dt><dd>{data.followUps.completed}</dd></div><div><dt>Overdue</dt><dd className={data.followUps.overdue ? "overdue-text" : ""}>{data.followUps.overdue}</dd></div></dl></section>
  </>;
}

function MetricStrip({ items }: { items: { label: string; value: string | number; note: string }[] }) {
  return <section className="report-metrics">{items.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.note}</small></article>)}</section>;
}

function ReportDistribution({ title, eyebrow, values, formatter = (value) => String(value) }: { title: string; eyebrow: string; values: Record<string, number>; formatter?: (value: number) => string }) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return <section className="report-section"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div></div><div className="distribution-list">{entries.map(([key, value]) => <div key={key}><span>{labels[key] ?? key}</span><i><b style={{ width: `${Math.max(3, value / max * 100)}%` }} /></i><strong>{formatter(value)}</strong></div>)}{!entries.length && <p className="empty-block">No data in this period.</p>}</div></section>;
}

function TrendChart({ title, eyebrow, values }: { title: string; eyebrow: string; values: { label: string; value: number; display: string }[] }) {
  const max = Math.max(1, ...values.map((item) => item.value));
  return <section className="report-section"><div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div><CalendarRange size={18} /></div><div className="trend-chart">{values.map((item) => <div className="trend-column" key={item.label} title={`${item.label}: ${item.display}`}><span>{item.display}</span><i><b style={{ height: `${Math.max(4, item.value / max * 100)}%` }} /></i><small>{item.label.slice(item.label.length > 7 ? 5 : 0)}</small></div>)}{!values.length && <p className="empty-block">No activity in this period.</p>}</div></section>;
}
