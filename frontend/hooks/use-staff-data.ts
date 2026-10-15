"use client";

import { useQuery } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { useAuthStore } from "@/lib/auth-store";
import { readApiError } from "@/lib/catalog-api";

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...options });
  if (!res.ok) {
    if (res.status === 401) await useAuthStore.getState().refreshSession();
    throw new Error(await readApiError(res, "Không thể hoàn thành thao tác. Vui lòng thử lại."));
  }
  return res.json();
}

export function useStaffData<T>(key: string, url: string) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [key, user?.id, url], enabled: !!user,
    queryFn: ({ signal }) => apiRequest<T>(url, { signal }),
    refetchInterval: 10000, refetchIntervalInBackground: false, retry: false,
  }, getQueryClient());
}

export function refreshStaffData() {
  return getQueryClient().invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string"
    && ["seller-leads", "seller-quotes", "seller-promotions", "seller-inventory", "seller-dashboard", "warehouse-inventory", "configuration-price"].includes(q.queryKey[0]) });
}
