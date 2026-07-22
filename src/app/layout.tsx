import { Bebas_Neue, DM_Sans } from "next/font/google";
import type { Metadata } from "next";

import { AuthRecoveryRedirect } from "@/components/auth-recovery-redirect";

import "./globals.css";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "The League",
  description: "Friendly wagers. Real standings. Your crew.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <AuthRecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
