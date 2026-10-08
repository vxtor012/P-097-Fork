"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [sent, setSent] = useState(false);
  if (sent) return <p className="text-white">Cảm ơn bạn đã đăng ký nhận thông tin ưu đãi.</p>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSent(true); /* TODO: gửi tới backend */ }} className="flex w-full max-w-md gap-2">
      <input type="email" required placeholder="Email của bạn" aria-label="Email" className="min-w-0 flex-1 rounded-full bg-white px-5 py-3 text-slate-900 outline-none placeholder:text-slate-400" />
      <button className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500">Đăng ký</button>
    </form>
  );
}
