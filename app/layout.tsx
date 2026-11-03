import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Thai } from "next/font/google";
import { AppShell } from "@/components/shell";
import "./globals.css";

const noto = Noto_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-noto",
  display: "swap",
});

const thai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["300", "400", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "dona",
  description: "ระบบจัดการองค์กร",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/dona-logo.png", type: "image/png", sizes: "500x500" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${noto.variable} ${thai.variable} h-full`}>
      <body className="h-full antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
