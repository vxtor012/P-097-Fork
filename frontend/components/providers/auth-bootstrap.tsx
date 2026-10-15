"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";

export function AuthBootstrap() {
  const refresh = useAuthStore((s) => s.refreshSession);
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason?.name === "AbortError" ||
        (typeof reason?.message === "string" && reason.message.includes("aborted"))
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  return null;
}
