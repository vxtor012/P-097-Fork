import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";
export const maxDuration = 65;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${BACKEND.replace(/\/$/, "")}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
