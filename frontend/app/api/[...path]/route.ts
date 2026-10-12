import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const backendPath = path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${BACKEND}/api/v1/${backendPath}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (!["host", "connection", "content-length"].includes(k)) {
      headers.set(key, value);
    }
  });

  const method = req.method;
  let body: BodyInit | undefined = undefined;
  if (!["GET", "HEAD"].includes(method)) {
    const text = await req.text();
    if (text) {
      body = text;
      headers.set("content-type", req.headers.get("content-type") ?? "application/json");
    }
  }

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const resHeaders = new Headers();
    res.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (!["content-encoding", "transfer-encoding"].includes(k)) {
        resHeaders.set(key, value);
      }
    });

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Proxy to backend failed: ${String(err)}` },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
