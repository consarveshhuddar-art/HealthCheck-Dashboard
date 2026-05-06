import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist_Mono, Inter } from "next/font/google";
import { DashboardNavProvider } from "@/components/DashboardNavProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Health check dashboard",
  description: "Jenkins health-check runs and Supabase failure analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="relative min-h-full bg-[#F6F8FB] font-sans text-[#0B1220]">
        <Suspense fallback={null}>
          <DashboardNavProvider>{children}</DashboardNavProvider>
        </Suspense>
      </body>
    </html>
  );
}
