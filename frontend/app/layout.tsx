import { BRAND } from "@/lib/brand";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthBootstrap } from "@/components/providers/auth-bootstrap";
import { FloatingChat } from "@/components/chat/floating-chat";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND.siteTitle,
  description: "Tìm xe phù hợp, so sánh giá, tính trả góp với AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} font-sans antialiased`} suppressHydrationWarning>
        <AuthBootstrap />
        {children}
        <FloatingChat />
      </body>
    </html>
  );
}