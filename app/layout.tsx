import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "CPMSL - Gestion Scolaire",
  description: "Application de gestion scolaire",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
