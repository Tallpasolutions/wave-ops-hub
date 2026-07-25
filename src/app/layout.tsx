import type { Metadata, Viewport } from "next";
import { Manrope, Poppins, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800", "900"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { template: '%s | Wave Ops Hub', default: 'Wave Ops Hub' },
  description: 'Plataforma operacional multi-tenant para gestão de OSs e pagamentos.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wave Ops',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Wave Ops Hub',
    description: 'Plataforma operacional multi-tenant para gestão de OSs e pagamentos.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#050814',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${poppins.variable} ${jetbrainsMono.variable}`}>
      <body className="font-body antialiased">
        {children}
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
