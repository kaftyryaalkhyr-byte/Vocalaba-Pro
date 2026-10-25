"use client";

import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

type Props = { apiPath: string; redirectTo: string };

export default function OwnerAccountManager({ apiPath, redirectTo }: Props) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSending(true);
    try {
      const response = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send invitation.");
      setMessage(result.message ?? "Invitation sent.");
      setEmail("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send invitation.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="account-manager" aria-labelledby="account-manager-title">
      <div className="section-kicker"><UserPlus size={15} /> إدارة الحسابات</div>
      <h3 id="account-manager-title">إضافة مستخدم</h3>
      <p className="section-copy">أرسل دعوة إلى البريد الإلكتروني. الحساب الجديد يبدأ بالخطة المجانية وحد 10,000 حرف شهريًا.</p>
      <form className="account-invite-form" onSubmit={inviteUser}>
        <label htmlFor="invite-email">البريد الإلكتروني</label>
        <div className="account-invite-controls">
          <input id="invite-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="user@example.com" />
          <button className="primary-button" type="submit" disabled={isSending}>{isSending ? "جارٍ الإرسال…" : "إرسال دعوة"}</button>
        </div>
      </form>
      {message && <p className="inline-message notice-message" role="status">{message}</p>}
      {error && <p className="inline-message error-message" role="alert">{error}</p>}
    </section>
  );
}
