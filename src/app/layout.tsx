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
      <head>
        <script defer src="https://cloud.umami.is/script.js" data-website-id="07ed94e7-4762-493d-a942-4152f9d813f2"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
