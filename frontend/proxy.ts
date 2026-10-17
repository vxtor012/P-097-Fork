import { NextRequest, NextResponse } from "next/server";

const ROLES: Record<string, string[]> = {
  "/seller": ["seller", "admin"],
  "/warehouse": ["warehouse", "warehouse_manager", "admin"],
  "/admin": ["admin"],
};

export async function proxy(req: NextRequest) {
  const prefix = Object.keys(ROLES).find((p) => req.nextUrl.pathname.startsWith(p));
  if (!prefix) return NextResponse.next();
  const token = req.cookies.get("vf-session")?.value;
  let role: string | undefined;
  if (token) {
    try {
      const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
      const response = await fetch(`${backend.replace(/\/$/, "")}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (response.ok) role = (await response.json()).user?.role;
    } catch {
      // Failed authentication checks cannot authorize protected pages.
    }
  }
  if (role && ROLES[prefix].includes(role)) return NextResponse.next();
  const target = new URL("/login", req.url);
  target.searchParams.set("from", req.nextUrl.pathname);
  if (role) target.searchParams.set("error", "unauthorized");
  return NextResponse.redirect(target);
}

export const config = { matcher: ["/seller/:path*", "/warehouse/:path*", "/admin/:path*"] };
