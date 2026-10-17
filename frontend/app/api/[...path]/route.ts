import { NextRequest, NextResponse } from "next/server";

import { hasValidRequestOrigin } from "@/lib/request-origin";

const BACKEND = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const backendPath = path.join("/");
  const url = new URL(req.url);
  if (!["GET", "HEAD"].includes(req.method) && !hasValidRequestOrigin(req)) {
    return NextResponse.json({ detail: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  }
  const headers = new Headers();
  for (const key of ["content-type", "accept", "authorization"]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  const token = req.cookies.get("vf-session")?.value;
  if (!headers.has("authorization") && token) headers.set("authorization", `Bearer ${token}`);
  const customerSecret = req.cookies.get("vf-chat-secret")?.value;
  const newCustomerSecret = !token && backendPath === "chat/session" && !customerSecret
    ? crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")
    : undefined;
  const chatSecret = customerSecret ?? newCustomerSecret;
  if (chatSecret && /^[a-f0-9]{64}$/.test(chatSecret)) headers.set("x-chat-secret", chatSecret);
  try {
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
    const response = await fetch(`${BACKEND}/api/v1/${backendPath}${url.search}`, {
      method: req.method, headers, body: body || undefined, cache: "no-store",
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(15000)]),
    });
    if (backendPath === "auth/login" && response.ok) {
      const data = await response.json();
      if (typeof data.token !== "string" || !data.user) throw new Error("Invalid login response");
      const result = NextResponse.json({ user: data.user }, { headers: { "Cache-Control": "no-store" } });
      result.cookies.set("vf-session", data.token, { httpOnly: true, secure: url.protocol === "https:",
        sameSite: "lax", path: "/", maxAge: 7 * 86400 });
      result.cookies.delete("vf-auth");
      return result;
    }
    const responseHeaders = new Headers();
    for (const key of ["content-type", "content-disposition"]) {
      const value = response.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    responseHeaders.set("cache-control", "private, no-store");
    const result = new NextResponse(response.body, { status: response.status, headers: responseHeaders });
    if (backendPath === "chat/session" && response.ok && newCustomerSecret) {
      result.cookies.set("vf-chat-secret", newCustomerSecret, { httpOnly: true,
        secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: 180 * 86400 });
    }
    if (backendPath === "auth/logout" && response.ok) result.cookies.delete("vf-chat-secret");
    if ((backendPath === "auth/logout" && (response.ok || response.status === 401))
      || (backendPath === "auth/me" && response.status === 401)) result.cookies.delete("vf-session");
    return result;
  } catch {
    return NextResponse.json({ detail: "Không kết nối được máy chủ. Vui lòng thử lại." }, { status: 502 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
