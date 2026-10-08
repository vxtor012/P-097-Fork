import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { AuthButton } from "@/components/shared/auth-button";

export function SiteNav({ dark = false }: { dark?: boolean }) {
  const link = dark ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-slate-900";
  return (
    <header className={`sticky top-0 z-40 backdrop-blur ${dark ? "bg-[#0b1220]/80" : "bg-white/90 border-b border-slate-200"}`}>
      <div className="flex h-16 w-full items-center justify-between px-6 xl:px-10">
        <Link href="/" className={`text-lg font-bold tracking-[.3em] ${dark ? "text-white" : "text-slate-900"}`}>{BRAND.name}</Link>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link href="/#dong-xe" className={link}>Dòng xe</Link>
          <Link href="/configurator" className={link}>Cấu hình xe</Link>
          <Link href="/#uu-dai" className={link}>Ưu đãi</Link>
        </nav>
        <AuthButton />
      </div>
    </header>
  );
}
