"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { AuthButton } from "@/components/shared/auth-button";
import styles from "./landing-nav.module.css";

const LINKS = [
  { href: "/#trai-nghiem", label: "Khám phá trải nghiệm" },
  { href: "/configurator", label: "Cấu hình xe" },
  { href: "/#showroom", label: "Tìm đại lý" },
];

export function LandingNav({ dark = false }: { dark?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className={`${styles.header} ${dark ? styles.dark : ""}`} onKeyDown={(event) => {
      if (event.key === "Escape") setMenuOpen(false);
    }}>
      <div className={styles.inner}>
        <Link href="/" aria-label={`${BRAND.name} — Trang chủ`} className={styles.brand} onClick={() => setMenuOpen(false)}>
          <svg width="31" height="28" viewBox="0 0 31 28" fill="none" aria-hidden="true">
            <path d="M2 4L15.5 12L29 4L15.5 25L2 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M2 4L15.5 18L29 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span>{BRAND.name}</span>
        </Link>
        <nav aria-label="Điều hướng chính" className={styles.desktopNav}>
          {LINKS.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <div className={styles.auth}><AuthButton /></div>
          <button className={styles.menuButton} type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-landing-navigation" aria-label={menuOpen ? "Đóng menu" : "Mở menu"}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-landing-navigation" className={styles.mobileNav} aria-label="Điều hướng trên điện thoại">
        {LINKS.map((link) => <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}<span aria-hidden="true">↗</span></Link>)}
      </nav>}
    </header>
  );
}
