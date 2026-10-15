import "server-only";
import type { Catalog } from "@/lib/catalog-api";

export async function getServerCatalog(): Promise<Catalog | null> {
  try {
    const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
    const response = await fetch(`${backend.replace(/\/$/, "")}/api/v1/vehicles`, {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data: Catalog = await response.json();
    return data.vehicles && Object.keys(data.vehicles).length ? data : null;
  } catch {
    return null;
  }
}

export interface Dealer {
  id: string;
  name: string;
  province: string;
  address: string | null;
  phone: string | null;
}

export async function getServerDealers(): Promise<Dealer[] | null> {
  try {
    const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
    const response = await fetch(`${backend.replace(/\/$/, "")}/api/v1/dealers`, {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    return response.ok ? (await response.json()).dealers : null;
  } catch {
    return null;
  }
}
