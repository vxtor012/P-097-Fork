"use client";

let bootstrap: Promise<string> | undefined;

export function ensureCustomerSession(): Promise<string> {
  if (bootstrap) return bootstrap;
  bootstrap = (async () => {
    const headers = { "Content-Type": "application/json" };
    let id = sessionStorage.getItem("vf_session");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) id = crypto.randomUUID();
    for (let attempt = 0; attempt < 2; attempt++) {
      sessionStorage.setItem("vf_session", id);
      const res = await fetch("/api/chat/session", { method: "POST", headers,
        body: JSON.stringify({ session_id: id, message: "session" }), cache: "no-store" });
      if (res.ok) return id;
      if (res.status !== 403) throw new Error("Không mở được phiên tư vấn. Vui lòng tải lại trang.");
      id = crypto.randomUUID();
    }
    throw new Error("Không xác thực được phiên tư vấn.");
  })().finally(() => { bootstrap = undefined; });
  return bootstrap;
}
