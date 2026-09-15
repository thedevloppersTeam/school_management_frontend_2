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

// Cookie et Lobster n'appartiennent qu'au gabarit imprime (DESIGN.md) et
// n'ecrivent aucun glyphe a l'ecran. La declaration reste globale parce que le
// gabarit est monte depuis cinq emplacements ; `preload: false` evite seulement
// de les precharger sur des routes qui ne les affichent jamais.
const cookie = Cookie({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-cookie",
  preload: false,
});

const lobster = Lobster({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-lobster",
  preload: false,
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
