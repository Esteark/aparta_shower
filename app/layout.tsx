import type { Metadata } from "next";
import { Geist, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-body",
  subsets: ["latin"],
});

const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const title = "Aparta Shower Cumpleañero 🎉";
const description =
  "Confirma tu asistencia y elige qué vas a traer — ¡nos vemos el 3 de octubre!";
// 1200×630 composition of the title + heads (public/og-image.jpg), kept
// small (<300 KB) so WhatsApp shows the preview.
const ogImage = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Aparta Shower Cumpleañero",
};

// Social previews need absolute URLs. Vercel exposes the production domain
// at build time, so nothing is hard-coded; localhost covers local builds.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Aparta Shower Cumpleañero",
    locale: "es_CO",
    type: "website",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
  // Private invite: keep it out of search engines (public/robots.txt too).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${pressStart.variable}`}>
      <body>{children}</body>
    </html>
  );
}
