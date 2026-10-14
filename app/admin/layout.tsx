// app/admin/layout.tsx
// Server Component — toute l'interactivité est déléguée à AdminLayoutShell
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { AcademicYearProvider } from "@/lib/contexts/academic-year-context";

/**
 * SEUL point de montage de `AcademicYearProvider`, et c'est essentiel : un
 * provider par page recréerait exactement le défaut qu'il corrige — plusieurs
 * lectures indépendantes de l'année active, libres de diverger.
 *
 * Il englobe le shell, pas l'inverse : le bandeau de `AdminLayoutShell` est
 * lui-même un consommateur, et doit donc se trouver DANS le provider.
 */
export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AcademicYearProvider>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </AcademicYearProvider>
  );
}