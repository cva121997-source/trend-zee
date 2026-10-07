import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TREND ZEE — Wear your next chapter",
  description: "Clothing, bags and footwear for every version of your day.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
