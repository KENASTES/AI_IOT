import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Food Match — AI กินไรดี",
  description: "เลือกมื้อที่ใช่ใน 5 วินาที ด้วยงบ ความชอบ และ Food Memory",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
