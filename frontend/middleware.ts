import { NextRequest, NextResponse } from "next/server";

// Routes cần login và role tương ứng
const PROTECTED: Record<string, string[]> = {
  "/seller":    ["seller"],
  "/warehouse": ["warehouse", "warehouse_manager"],
};

function getRole(req: NextRequest): string | null {
  try {
    const raw = req.cookies.get("vf-auth")?.value;
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    const parsed  = JSON.parse(decoded);
    return parsed?.state?.user?.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const matchedPrefix = Object.keys(PROTECTED).find((prefix) =>
    pathname.startsWith(prefix)
  );

  // Route không cần bảo vệ
  if (!matchedPrefix) return NextResponse.next();

  const role    = getRole(req);
  const allowed = PROTECTED[matchedPrefix];

  if (!role || !allowed.includes(role)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    if (role) loginUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/seller/:path*", "/warehouse/:path*"],
};
