import type { Metadata } from "next";
import { Cookie, Libre_Baskerville, Inter, Lobster } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const cookie = Cookie({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-cookie",
});

const lobster = Lobster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lobster",
});

export const metadata: Metadata = {
  title: "CPMSL - Gestion Scolaire",
  description: "Application de gestion scolaire",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${libreBaskerville.variable} ${inter.variable} ${cookie.variable} ${lobster.variable}`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
