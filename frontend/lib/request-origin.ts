/** Next.js may reconstruct request.url with its internal listening hostname. */
export function hasValidRequestOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    const host = request.headers.get("host") ?? target.host;
    return origin === source.origin && source.protocol === target.protocol
      && source.host === host;
  } catch {
    return false;
  }
}
