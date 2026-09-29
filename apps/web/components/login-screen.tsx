"use client";

import { useState } from "react";
import { ArrowRight, Dumbbell, KeyRound, ShieldCheck } from "lucide-react";
import { apiFetch, responseMessage } from "../lib/api";

type Props = { invitationToken?: string; onAuthenticated: () => Promise<void> };

export function LoginScreen({ invitationToken, onAuthenticated }: Props) {
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function login(formData: FormData) {
    setBusy(true); setError("");
    const response = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData)),
    }, false);
    if (!response.ok) setError(await responseMessage(response, "Could not sign in"));
    else await onAuthenticated();
    setBusy(false);
  }

  async function acceptInvitation(formData: FormData) {
    setBusy(true); setError("");
    const response = await apiFetch("/auth/accept-invitation", {
      method: "POST",
      body: JSON.stringify({ token: invitationToken, password: formData.get("password") }),
    }, false);
    if (!response.ok) setError(await responseMessage(response, "Could not accept invitation"));
    else setAccepted(true);
    setBusy(false);
  }

  return <main className="auth-page">
    <section className="auth-panel">
      <div className="auth-brand"><span className="brand-mark">P</span><span>Pulse</span></div>
      <div className="auth-copy">
        <span className="auth-icon">{invitationToken ? <ShieldCheck size={24} /> : <Dumbbell size={24} />}</span>
        <span className="eyebrow">GYM GROWTH OS</span>
        <h1>{invitationToken && !accepted ? "Join your gym workspace" : "Welcome back"}</h1>
        <p>{invitationToken && !accepted ? "Create a secure password to activate your staff account." : "Sign in to manage members, payments, and today’s floor."}</p>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {invitationToken && !accepted ? <form className="auth-form" action={acceptInvitation}>
        <label>Password<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label>
        <small>Use at least 12 characters with uppercase, lowercase, and a number.</small>
        <button className="primary" disabled={busy}><KeyRound size={17} /> {busy ? "Activating..." : "Activate account"}</button>
      </form> : <form className="auth-form" action={login}>
        {accepted && <div className="auth-success">Account activated. Sign in to continue.</div>}
        <label>Workspace<input name="workspace" required defaultValue="pulse-fitness" autoComplete="organization" /></label>
        <label>Email<input name="email" type="email" required defaultValue={accepted ? "" : "owner@pulse.local"} autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="primary" disabled={busy}>{busy ? "Signing in..." : "Sign in"}<ArrowRight size={17} /></button>
      </form>}
      {!invitationToken && <a className="auth-back" href="/platform">Platform administration</a>}
    </section>
    <aside className="auth-aside"><div><span>Secure operations</span><strong>One workspace.<br />Every shift.</strong><p>Role-aware access keeps the right tools in the right hands.</p></div></aside>
  </main>;
}
