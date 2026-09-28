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

export const metadata: Metadata = {
  title: "Aparta Shower Cumpleañero",
  description:
    "Invitación al Aparta Shower Cumpleañero — confirma tu asistencia y qué vas a llevar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${pressStart.variable}`}>
      <body>{children}</body>
    </html>
  );
}
