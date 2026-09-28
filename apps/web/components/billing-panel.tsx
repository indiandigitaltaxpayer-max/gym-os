"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Eye, Printer, ReceiptIndianRupee, RotateCcw, Search, X } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Branch = { id: string; name: string; address?: string | null };
type InvoiceItem = { id: string; description: string; quantity: number; unitPriceMinor: number; subtotalMinor: number; taxRateBps: number; taxMinor: number; totalMinor: number };
type Payment = { id: string; receiptNumber: string | null; amountMinor: number; method: string; status: string; providerRef: string | null; note: string | null; paidAt: string; reversedAt: string | null; reversalReason: string | null; recordedBy?: { name: string } | null; reversedBy?: { name: string } | null };
type Invoice = {
  id: string; invoiceNumber: string; issuedAt: string; dueAt: string; status: string; effectiveStatus: string;
  subtotalMinor: number; discountMinor: number; taxMinor: number; totalMinor: number; paidMinor: number; balanceMinor: number;
  voidReason?: string | null; member: { id: string; memberNumber: string; firstName: string; lastName: string; phone?: string; email?: string | null };
  branch: Branch; lineItems: InvoiceItem[]; payments?: Payment[]; tenant?: { name: string; currency: string }; issuedBy?: { name: string } | null;
};
type ListResponse = { items: Invoice[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type Summary = { revenueThisMonthMinor: number; outstandingMinor: number; overdueMinor: number; invoicesThisMonth: number };

const date = (value: string) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTime = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function BillingPanel({ branches, currency, canWrite, canViewSummary, canVoid, canReverse, onNotice }: { branches: Branch[]; currency: string; canWrite: boolean; canViewSummary: boolean; canVoid: boolean; canReverse: boolean; onNotice: (message: string) => void }) {
  const money = useCallback((minor = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100), [currency]);
  const [items, setItems] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [reasonAction, setReasonAction] = useState<{ kind: "void" | "reverse"; id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (query.trim()) params.set("search", query.trim());
    if (status) params.set("status", status);
    if (branchId) params.set("branchId", branchId);
    const response = await apiFetch(`/invoices?${params}`);
    if (response.ok) {
      const body: ListResponse = await response.json();
      setItems(body.items); setPagination(body.pagination);
    } else onNotice(await responseMessage(response, "Could not load invoices"));
    setLoading(false);
  }, [branchId, onNotice, page, query, status]);

  const loadSummary = useCallback(async () => {
    if (!canViewSummary) return;
    const response = await apiFetch("/billing/summary");
    if (response.ok) setSummary(await response.json());
  }, [canViewSummary]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { setPage(1); }, [query, status, branchId]);

  async function openInvoice(invoiceId: string) {
    const response = await apiFetch(`/invoices/${invoiceId}`);
    if (!response.ok) return onNotice(await responseMessage(response, "Could not load invoice"));
    setSelected(await response.json());
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await apiFetch("/payments", { method: "POST", body: JSON.stringify({
      invoiceId: selected.id,
      amountMinor: Math.round(Number(data.get("amount")) * 100),
      method: data.get("method"), providerRef: data.get("providerRef") || undefined,
      note: data.get("note") || undefined, paidAt: data.get("paidAt") || undefined,
      idempotencyKey: crypto.randomUUID(),
    }) });
    if (!response.ok) return onNotice(await responseMessage(response, "Could not record payment"));
    form.reset(); onNotice("Payment recorded and receipt generated");
    await openInvoice(selected.id); await load(); await loadSummary();
  }

  async function submitReason(data: FormData) {
    if (!reasonAction) return;
    const path = reasonAction.kind === "void" ? `/invoices/${reasonAction.id}/void` : `/payments/${reasonAction.id}/reverse`;
    const response = await apiFetch(path, { method: "POST", body: JSON.stringify({ reason: data.get("reason") }) });
    if (!response.ok) return onNotice(await responseMessage(response, reasonAction.kind === "void" ? "Could not void invoice" : "Could not reverse payment"));
    const invoiceId = selected?.id; setReasonAction(null); onNotice(reasonAction.kind === "void" ? "Invoice voided" : "Payment reversed");
    if (invoiceId) await openInvoice(invoiceId); await load(); await loadSummary();
  }

  return <div className="billing-workspace">
    {canViewSummary && <section className="billing-summary" aria-label="Billing summary">
      <article><span>Revenue this month</span><strong>{money(summary?.revenueThisMonthMinor)}</strong></article>
      <article><span>Outstanding</span><strong>{money(summary?.outstandingMinor)}</strong></article>
      <article><span>Overdue</span><strong>{money(summary?.overdueMinor)}</strong></article>
      <article><span>Invoices this month</span><strong>{summary?.invoicesThisMonth ?? 0}</strong></article>
    </section>}
    <section className="workspace">
      <div className="section-heading member-heading"><div><span className="eyebrow">COLLECTIONS</span><h2>Billing</h2><small>{pagination.total} invoices</small></div></div>
      <div className="billing-filters">
        <label className="search"><Search size={17} /><input aria-label="Search invoices" placeholder="Invoice or member" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Filter invoice status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="PARTIALLY_PAID">Partially paid</option><option value="OVERDUE">Overdue</option><option value="PAID">Paid</option><option value="VOID">Void</option></select>
        <select aria-label="Filter billing branch" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Member</th><th>Branch</th><th>Due</th><th>Total</th><th>Balance</th><th>Status</th><th><span className="sr-only">View</span></th></tr></thead><tbody>
        {items.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{date(invoice.issuedAt)}</small></td><td><strong>{invoice.member.firstName} {invoice.member.lastName}</strong><small>{invoice.member.memberNumber}</small></td><td>{invoice.branch.name}</td><td>{date(invoice.dueAt)}</td><td>{money(invoice.totalMinor)}</td><td>{money(invoice.balanceMinor)}</td><td><span className={`status ${invoice.effectiveStatus.toLowerCase()}`}>{invoice.effectiveStatus.toLowerCase().replaceAll("_", " ")}</span></td><td className="row-action"><button className="icon-button compact-icon" title="View invoice" aria-label={`View ${invoice.invoiceNumber}`} onClick={() => void openInvoice(invoice.id)}><Eye size={16} /></button></td></tr>)}
        {!loading && !items.length && <tr><td className="empty" colSpan={8}>No invoices match these filters.</td></tr>}{loading && <tr><td className="empty" colSpan={8}>Loading invoices...</td></tr>}
      </tbody></table></div>
      <div className="pagination"><span>Page {pagination.page} of {pagination.totalPages}</span><div><button className="icon-button" title="Previous page" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><button className="icon-button" title="Next page" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
    </section>
    {selected && <InvoiceModal invoice={selected} money={money} canWrite={canWrite} canVoid={canVoid} canReverse={canReverse} onClose={() => setSelected(null)} onPay={recordPayment} onReceipt={setReceipt} onVoid={() => setReasonAction({ kind: "void", id: selected.id })} onReverse={(id) => setReasonAction({ kind: "reverse", id })} />}
    {selected && receipt && <ReceiptModal invoice={selected} payment={receipt} money={money} onClose={() => setReceipt(null)} />}
    {reasonAction && <ReasonModal kind={reasonAction.kind} onClose={() => setReasonAction(null)} onSave={submitReason} />}
  </div>;
}

function InvoiceModal({ invoice, money, canWrite, canVoid, canReverse, onClose, onPay, onReceipt, onVoid, onReverse }: { invoice: Invoice; money: (minor?: number) => string; canWrite: boolean; canVoid: boolean; canReverse: boolean; onClose: () => void; onPay: (event: FormEvent<HTMLFormElement>) => Promise<void>; onReceipt: (payment: Payment) => void; onVoid: () => void; onReverse: (paymentId: string) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal billing-modal print-document" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
    <div className="modal-title no-print"><div><span className="eyebrow">{invoice.invoiceNumber}</span><h2>Invoice detail</h2></div><div className="profile-actions"><button className="icon-button" title="Print invoice" onClick={() => window.print()}><Printer size={17} /></button><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div></div>
    <div className="billing-document">
      <div className="document-heading"><div><span className="eyebrow">INVOICE</span><h2>{invoice.tenant?.name ?? "Gym"}</h2><small>{invoice.branch.name}{invoice.branch.address ? ` · ${invoice.branch.address}` : ""}</small></div><div><strong>{invoice.invoiceNumber}</strong><small>Issued {date(invoice.issuedAt)}</small><small>Due {date(invoice.dueAt)}</small></div></div>
      <div className="bill-to"><span>Billed to</span><strong>{invoice.member.firstName} {invoice.member.lastName}</strong><small>{invoice.member.memberNumber} · {invoice.member.phone}</small></div>
      <div className="table-wrap"><table><thead><tr><th>Description</th><th>Price</th><th>Tax</th><th>Total</th></tr></thead><tbody>{invoice.lineItems.map((item) => <tr key={item.id}><td>{item.description}</td><td>{money(item.subtotalMinor)}</td><td>{item.taxRateBps / 100}% · {money(item.taxMinor)}</td><td>{money(item.totalMinor)}</td></tr>)}</tbody></table></div>
      <div className="invoice-totals"><span>Subtotal<strong>{money(invoice.subtotalMinor)}</strong></span><span>Tax<strong>{money(invoice.taxMinor)}</strong></span><span>Paid<strong>{money(invoice.paidMinor)}</strong></span><span className="grand-total">Balance<strong>{money(invoice.balanceMinor)}</strong></span></div>
      <div className="document-status"><span className={`status ${invoice.effectiveStatus.toLowerCase()}`}>{invoice.effectiveStatus.toLowerCase().replaceAll("_", " ")}</span>{invoice.voidReason && <small>Reason: {invoice.voidReason}</small>}</div>
      <section className="payment-history"><h3>Payment history</h3>{invoice.payments?.map((payment) => <div className="payment-row" key={payment.id}><div><strong>{payment.receiptNumber ?? "Legacy payment"}</strong><small>{dateTime(payment.paidAt)} · {payment.method.replaceAll("_", " ").toLowerCase()}{payment.providerRef ? ` · ${payment.providerRef}` : ""}</small>{payment.reversalReason && <small>Reversed: {payment.reversalReason}</small>}</div><div><strong>{money(payment.amountMinor)}</strong><div className="table-actions"><button className="icon-button compact-icon" title="View receipt" onClick={() => onReceipt(payment)}><ReceiptIndianRupee size={15} /></button>{canReverse && payment.status === "CAPTURED" && <button className="icon-button compact-icon danger no-print" title="Reverse payment" onClick={() => onReverse(payment.id)}><RotateCcw size={15} /></button>}</div></div></div>)}{!invoice.payments?.length && <p className="empty-profile">No payments recorded.</p>}</section>
      {canWrite && invoice.balanceMinor > 0 && invoice.status !== "VOID" && <form className="payment-form no-print" onSubmit={(event) => void onPay(event)}><h3 className="full">Record payment</h3><label>Amount<input required name="amount" type="number" min="0.01" max={invoice.balanceMinor / 100} step="0.01" defaultValue={invoice.balanceMinor / 100} /></label><label>Method<select required name="method" defaultValue="UPI"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option></select></label><label>Payment date<input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Reference<input name="providerRef" maxLength={120} /></label><label className="full">Note<textarea name="note" rows={2} /></label><div className="form-actions full"><button className="primary" type="submit"><ReceiptIndianRupee size={16} /> Record payment</button></div></form>}
    </div>
    {canVoid && invoice.paidMinor === 0 && invoice.status !== "VOID" && <div className="profile-footer no-print"><button className="secondary danger" onClick={onVoid}><Ban size={16} /> Void invoice</button></div>}
  </div></div>;
}

function ReceiptModal({ invoice, payment, money, onClose }: { invoice: Invoice; payment: Payment; money: (minor?: number) => string; onClose: () => void }) {
  return <div className="modal-backdrop nested-modal" role="presentation" onMouseDown={onClose}><div className="modal receipt-modal print-document" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title no-print"><div><span className="eyebrow">PAYMENT</span><h2>Receipt</h2></div><div className="profile-actions"><button className="icon-button" title="Print receipt" onClick={() => window.print()}><Printer size={17} /></button><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div></div><div className="receipt-content"><span className="eyebrow">RECEIPT</span><h2>{invoice.tenant?.name ?? "Gym"}</h2><strong className="receipt-number">{payment.receiptNumber ?? "Legacy payment"}</strong><div className="receipt-amount">{money(payment.amountMinor)}</div><dl><dt>Received from</dt><dd>{invoice.member.firstName} {invoice.member.lastName} ({invoice.member.memberNumber})</dd><dt>Invoice</dt><dd>{invoice.invoiceNumber}</dd><dt>Date</dt><dd>{dateTime(payment.paidAt)}</dd><dt>Method</dt><dd>{payment.method.replaceAll("_", " ").toLowerCase()}</dd>{payment.providerRef && <><dt>Reference</dt><dd>{payment.providerRef}</dd></>}</dl>{payment.status === "REVERSED" && <div className="reversal-banner">Reversed: {payment.reversalReason}</div>}</div></div></div>;
}

function ReasonModal({ kind, onClose, onSave }: { kind: "void" | "reverse"; onClose: () => void; onSave: (data: FormData) => Promise<void> }) {
  return <div className="modal-backdrop nested-modal" role="presentation" onMouseDown={onClose}><div className="modal small-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">FINANCIAL RECORD</span><h2>{kind === "void" ? "Void invoice" : "Reverse payment"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><form action={onSave}><label className="full">Reason<textarea required name="reason" rows={3} /></label><div className="form-actions full"><button type="button" className="secondary" onClick={onClose}>Back</button><button className="primary destructive" type="submit">Confirm</button></div></form></div></div>;
}
