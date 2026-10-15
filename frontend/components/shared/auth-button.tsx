"use client";

import Link from "next/link";
import { useSyncExternalStore, useState } from "react";
import { useRouter } from 'next/navigation';
import { useAuthStore, ROLE_HOME } from "@/lib/auth-store";

const subscribeToNothing = () => () => {};
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

/** Chưa đăng nhập: nút "Đăng nhập". Đã đăng nhập: vào thẳng dashboard theo vai trò. */
export function AuthButton() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [error, setError] = useState('');
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientMountedSnapshot,
    getServerMountedSnapshot,
  );

  const base = "rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700";
  if (!mounted || !user || !ROLE_HOME[user.role] || user.role === "buyer") {
    return <Link href="/login" className={base}>Đăng nhập</Link>;
  }
  return (
    <div className="flex items-center gap-3">
      <Link href={ROLE_HOME[user.role]} className={base}>
        Vào dashboard · {user.name.split(" ").pop()}
      </Link>
      <button onClick={async () => {
        if (await logout()) { router.replace('/'); router.refresh(); }
        else setError('Chưa đăng xuất được. Vui lòng thử lại.');
      }} className="text-sm font-medium text-slate-500 hover:text-slate-900">Đăng xuất</button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
