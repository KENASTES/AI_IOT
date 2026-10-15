import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Food Match — กินไรดี & ทำเมนูไรกินดี",
  description: "AI ช่วยเลือกมื้อใกล้คุณหรือคิดเมนูจากวัตถุดิบที่มี พร้อม Food Memory และ Smart Budget",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
