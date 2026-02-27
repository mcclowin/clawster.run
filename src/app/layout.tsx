import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clawster — Deploy Your Bot",
  description: "Spawn autonomous AI agents into secure enclaves. Your keys stay yours.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
