"use client";

import { useState } from "react";
import { readApiError } from "@/lib/catalog-api";

export function NewsletterForm() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (sent) return <p className="text-white">Cảm ơn bạn đã đăng ký nhận thông tin ưu đãi.</p>;
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      if (loading) return;
      setLoading(true); setError("");
      try {
        const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, consent }) });
        if (!res.ok) throw new Error(await readApiError(res, 'Chưa ghi nhận được đăng ký. Vui lòng thử lại.'));
        setSent(true);
      } catch (error) { setError(error instanceof Error ? error.message : 'Đăng ký chưa thành công.'); }
      finally { setLoading(false); }
    }} className="w-full max-w-md space-y-3">
      <div className="flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email của bạn" aria-label="Email" className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-slate-900 outline-none placeholder:text-slate-400" />
        <button disabled={loading || !consent} className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{loading ? 'Đang gửi…' : 'Đăng ký'}</button>
      </div>
      <label className="flex items-start gap-2 text-xs text-white/70"><input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} />Tôi đồng ý lưu email để nhận thông tin từ đại lý.</label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </form>
  );
}
