import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthBootstrap } from "@/components/providers/auth-bootstrap";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VinFast AI - Tư vấn xe thông minh",
  description: "Tìm xe phù hợp, so sánh giá, tính trả góp với AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className={`${inter.className} font-sans antialiased`}><AuthBootstrap />{children}</body>
    </html>
  );
}

