"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Ban, Camera, Check, ChevronLeft, ChevronRight, Printer, QrCode, RefreshCw, Search, UserCheck, X } from "lucide-react";
import QRCode from "qrcode";
import { apiFetch, responseMessage } from "../lib/api";

type Branch = { id: string; name: string };
type AttendanceMember = {
  id: string; memberNumber: string; firstName: string; lastName: string; phone: string; status: string; hasActiveQr: boolean;
  homeBranch: Branch; memberships: { id: string; status: string; startsAt: string; endsAt: string; plan: { name: string } }[];
};
type AttendanceEntry = {
  id: string; checkedInAt: string; source: "FRONT_DESK" | "QR";
  member: { id: string; memberNumber: string; firstName: string; lastName: string };
  branch: Branch & { timezone: string }; membership?: { plan: { name: string } } | null; checkedInBy?: { name: string } | null;
};
type Summary = { localDate: string; month: string; todayVisits: number; uniqueToday: number; monthVisits: number; monthBySource: Record<string, number> };
type Page = { page: number; pageSize: number; total: number; totalPages: number };
type QrCredential = { token: string; issuedAt: string; regenerated: boolean };

const dateTime = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const date = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function AttendancePanel({ branches, onNotice, onAttendanceChanged }: { branches: Branch[]; onNotice: (message: string) => void; onAttendanceChanged: () => Promise<void> }) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [logs, setLogs] = useState<AttendanceEntry[]>([]);
  const [pagination, setPagination] = useState<Page>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [logQuery, setLogQuery] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [qr, setQr] = useState<{ member: AttendanceMember; credential: QrCredential; image: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  const loadMembers = useCallback(async () => {
    if (!branchId) return;
    setMemberLoading(true);
    const params = new URLSearchParams({ branchId });
    if (memberQuery.trim()) params.set("search", memberQuery.trim());
    const response = await apiFetch(`/attendance/members?${params}`);
    if (response.ok) setMembers((await response.json()).items);
    else onNotice(await responseMessage(response, "Could not load members for attendance"));
    setMemberLoading(false);
  }, [branchId, memberQuery, onNotice]);

  const loadSummary = useCallback(async () => {
    if (!branchId) return;
    const response = await apiFetch(`/attendance/summary?${new URLSearchParams({ branchId, month })}`);
    if (response.ok) setSummary(await response.json());
    else onNotice(await responseMessage(response, "Could not load attendance summary"));
  }, [branchId, month, onNotice]);

  const loadLogs = useCallback(async () => {
    if (!branchId) return;
    setLogLoading(true);
    const params = new URLSearchParams({ branchId, page: String(page), pageSize: "20" });
    if (logQuery.trim()) params.set("search", logQuery.trim());
    if (source) params.set("source", source);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const response = await apiFetch(`/attendance/logs?${params}`);
    if (response.ok) {
      const body = await response.json();
      setLogs(body.items); setPagination(body.pagination);
    } else onNotice(await responseMessage(response, "Could not load attendance log"));
    setLogLoading(false);
  }, [branchId, from, logQuery, onNotice, page, source, to]);

  useEffect(() => { const timer = window.setTimeout(() => void loadMembers(), 180); return () => window.clearTimeout(timer); }, [loadMembers]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { const timer = window.setTimeout(() => void loadLogs(), 180); return () => window.clearTimeout(timer); }, [loadLogs]);
  useEffect(() => { setPage(1); }, [branchId, logQuery, source, from, to]);

  async function refreshAttendance() {
    await Promise.all([loadMembers(), loadSummary(), loadLogs(), onAttendanceChanged()]);
  }

  async function manualCheckIn(member: AttendanceMember) {
    const response = await apiFetch("/attendance/check-ins/manual", { method: "POST", body: JSON.stringify({ memberId: member.id, branchId }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Check-in was declined"));
    onNotice(`${member.firstName} ${member.lastName} checked in successfully`);
    await refreshAttendance();
  }

  async function issueQr(member: AttendanceMember) {
    const response = await apiFetch(`/attendance/members/${member.id}/qr`, { method: "POST" });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not issue QR credential"));
    const credential: QrCredential = await response.json();
    const image = await QRCode.toDataURL(credential.token, { width: 300, margin: 2, errorCorrectionLevel: "M", color: { dark: "#17211c", light: "#ffffff" } });
    setQr({ member, credential, image });
    await loadMembers();
  }

  async function revokeQr() {
    if (!qr) return;
    const response = await apiFetch(`/attendance/members/${qr.member.id}/qr`, { method: "DELETE" });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not revoke QR credential"));
    onNotice(`${qr.member.firstName}'s QR credential was revoked`);
    setQr(null); await loadMembers();
  }

  async function qrCheckIn(token: string) {
    if (!token.trim()) return;
    const response = await apiFetch("/attendance/check-ins/qr", { method: "POST", body: JSON.stringify({ token: token.trim(), branchId }) });
    if (!response.ok) {
      const message = await responseMessage(response, "QR check-in was declined");
      setScanMessage(message); return;
    }
    const entry: AttendanceEntry = await response.json();
    setScanMessage(`${entry.member.firstName} ${entry.member.lastName} checked in successfully`);
    await refreshAttendance();
  }

  if (!branches.length) return <section className="workspace attendance-empty"><h2>Attendance</h2><p>No active branch is available for check-in.</p></section>;

  return <div className="attendance-workspace">
    <div className="attendance-topbar">
      <div><span className="eyebrow">FRONT DESK</span><h2>Attendance</h2></div>
      <label>Operating branch<select aria-label="Attendance operating branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <button className="primary" onClick={() => setScanOpen(true)}><Camera size={17} /> Scan member QR</button>
    </div>

    <section className="attendance-summary" aria-label="Attendance summary">
      <article><span>Visits today</span><strong>{summary?.todayVisits ?? 0}</strong><small>{summary?.localDate ?? "Current branch date"}</small></article>
      <article><span>Unique members today</span><strong>{summary?.uniqueToday ?? 0}</strong><small>Duplicate window enforced</small></article>
      <article><span>Visits this month</span><strong>{summary?.monthVisits ?? 0}</strong><small>{(summary?.monthBySource.FRONT_DESK ?? 0)} manual · {(summary?.monthBySource.QR ?? 0)} QR</small></article>
      <article><label>Reporting month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label></article>
    </section>

    <section className="workspace attendance-checkin">
      <div className="section-heading member-heading"><div><span className="eyebrow">QUICK ADMISSION</span><h2>Find a member</h2><small>Members from every branch can visit this location</small></div><label className="search"><Search size={17} /><input aria-label="Search members for check-in" placeholder="Name, number or phone" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} /></label></div>
      <div className="attendance-member-list">
        {members.map((member) => {
          const membership = member.memberships[0];
          const eligible = member.status === "ACTIVE" && membership?.status === "ACTIVE";
          return <article key={member.id} className="attendance-member">
            <span className="avatar">{member.firstName[0]}{member.lastName[0]}</span>
            <div><strong>{member.firstName} {member.lastName}</strong><small>{member.memberNumber} · {member.phone} · Home: {member.homeBranch.name}</small></div>
            <div className="attendance-plan"><strong>{membership?.plan.name ?? "No membership"}</strong><small>{membership ? `${membership.status.toLowerCase()} · until ${date(membership.endsAt)}` : "Admission unavailable"}</small></div>
            <div className="table-actions"><button className="icon-button compact-icon" title={member.hasActiveQr ? "Replace member QR" : "Issue member QR"} aria-label={`${member.hasActiveQr ? "Replace" : "Issue"} QR for ${member.firstName}`} onClick={() => void issueQr(member)}><QrCode size={16} /></button><button className="primary compact" disabled={!eligible} title={eligible ? "Record manual check-in" : "An active membership is required"} onClick={() => void manualCheckIn(member)}><UserCheck size={15} /> Check in</button></div>
          </article>;
        })}
        {!memberLoading && !members.length && <p className="empty-block">No members match this search.</p>}
        {memberLoading && <p className="empty-block">Finding members...</p>}
      </div>
    </section>

    <section className="workspace">
      <div className="section-heading member-heading"><div><span className="eyebrow">VISIT HISTORY</span><h2>Attendance log</h2><small>{pagination.total} recorded visits</small></div></div>
      <div className="attendance-filters">
        <label className="search"><Search size={17} /><input aria-label="Search attendance log" placeholder="Member name or number" value={logQuery} onChange={(event) => setLogQuery(event.target.value)} /></label>
        <select aria-label="Filter check-in source" value={source} onChange={(event) => setSource(event.target.value)}><option value="">All sources</option><option value="FRONT_DESK">Manual</option><option value="QR">QR</option></select>
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To<input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Member</th><th>Checked in</th><th>Plan</th><th>Source</th><th>Recorded by</th></tr></thead><tbody>
        {logs.map((entry) => <tr key={entry.id}><td><strong>{entry.member.firstName} {entry.member.lastName}</strong><small>{entry.member.memberNumber}</small></td><td><strong>{dateTime(entry.checkedInAt)}</strong><small>{entry.branch.name}</small></td><td>{entry.membership?.plan.name ?? "Historical visit"}</td><td><span className={`status ${entry.source === "QR" ? "active" : "open"}`}>{entry.source === "QR" ? "QR" : "Manual"}</span></td><td>{entry.checkedInBy?.name ?? "Legacy record"}</td></tr>)}
        {!logLoading && !logs.length && <tr><td className="empty" colSpan={5}>No attendance records match these filters.</td></tr>}{logLoading && <tr><td className="empty" colSpan={5}>Loading attendance...</td></tr>}
      </tbody></table></div>
      <div className="pagination"><span>Page {pagination.page} of {pagination.totalPages}</span><div><button className="icon-button" title="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><button className="icon-button" title="Next page" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
    </section>

    {scanOpen && <QrScanner branchName={branches.find((branch) => branch.id === branchId)?.name ?? "branch"} message={scanMessage} onMessage={setScanMessage} onScan={qrCheckIn} onClose={() => { setScanOpen(false); setScanMessage(""); }} />}
    {qr && <QrModal value={qr} onRegenerate={() => void issueQr(qr.member)} onRevoke={() => void revokeQr()} onClose={() => setQr(null)} />}
  </div>;
}

function QrScanner({ branchName, message, onMessage, onScan, onClose }: { branchName: string; message: string; onMessage: (message: string) => void; onScan: (token: string) => Promise<void>; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processing = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);

  const stop = useCallback(() => { controlsRef.current?.stop(); controlsRef.current = null; setCameraActive(false); }, []);
  useEffect(() => stop, [stop]);

  async function startCamera() {
    if (!videoRef.current) return;
    onMessage(""); processing.current = false;
    try {
      const reader = new BrowserQRCodeReader();
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result || processing.current) return;
        processing.current = true; stop(); void onScan(result.getText()).finally(() => { processing.current = false; });
      });
      setCameraActive(true);
    } catch {
      onMessage("Camera could not be opened. Check browser permission or enter the QR token below.");
      stop();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const token = String(new FormData(form).get("token") ?? "");
    await onScan(token); form.reset();
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">{branchName.toUpperCase()}</span><h2 id="scanner-title">Scan member QR</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><div className="scanner-content"><div className="camera-frame"><video ref={videoRef} muted playsInline />{!cameraActive && <button className="secondary" onClick={() => void startCamera()}><Camera size={17} /> Start camera</button>}</div>{message && <div className={`scan-result${message.includes("successfully") ? " success" : ""}`}>{message.includes("successfully") ? <Check size={18} /> : <Ban size={18} />}{message}</div>}<form className="token-form" onSubmit={(event) => void submit(event)}><label>QR token<input name="token" required autoComplete="off" placeholder="Paste or scan credential" /></label><button className="primary" type="submit"><QrCode size={16} /> Check in</button></form></div></div></div>;
}

function QrModal({ value, onRegenerate, onRevoke, onClose }: { value: { member: AttendanceMember; credential: QrCredential; image: string }; onRegenerate: () => void; onRevoke: () => void; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal qr-modal print-document" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title no-print"><div><span className="eyebrow">MEMBER CREDENTIAL</span><h2>Attendance QR</h2></div><div className="profile-actions"><button className="icon-button" title="Print member QR" onClick={() => window.print()}><Printer size={17} /></button><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div></div><div className="qr-document"><span className="brand-mark">P</span><h2>{value.member.firstName} {value.member.lastName}</h2><p>{value.member.memberNumber}</p><img src={value.image} alt={`Attendance QR for ${value.member.firstName} ${value.member.lastName}`} /><small>Present this code to authenticated reception staff.</small><small>Issued {dateTime(value.credential.issuedAt)}</small></div><div className="profile-footer no-print"><button className="secondary danger" onClick={onRevoke}><Ban size={16} /> Revoke</button><button className="secondary" onClick={onRegenerate}><RefreshCw size={16} /> Replace QR</button></div></div></div>;
}
