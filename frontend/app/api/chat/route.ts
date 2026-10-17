import { NextRequest, NextResponse } from "next/server";

import { hasValidRequestOrigin } from "@/lib/request-origin";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";
export const maxDuration = 65;

export async function POST(req: NextRequest) {
  if (!hasValidRequestOrigin(req)) {
    return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Nội dung yêu cầu không hợp lệ." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const secret = req.cookies.get("vf-chat-secret")?.value;
    if (secret) headers.set("x-chat-secret", secret);
    const token = req.cookies.get("vf-session")?.value;
    const authorization = req.headers.get("authorization") || (token ? `Bearer ${token}` : null);
    if (authorization) headers.set("authorization", authorization);
    const res = await fetch(`${BACKEND.replace(/\/$/, "")}/api/v1/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: typeof payload.detail === "string"
        ? payload.detail : "AI chưa sẵn sàng. Vui lòng thử lại sau ít phút." }, {
        status: res.status,
      });
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: controller.signal.aborted
      ? "AI phản hồi quá lâu. Vui lòng thử lại sau ít phút."
      : "Không thể kết nối AI. Vui lòng thử lại sau ít phút." },
    { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
