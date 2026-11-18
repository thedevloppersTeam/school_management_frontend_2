// app/teacher/layout.tsx
// Server Component — toute l'interactivité est déléguée à TeacherLayoutShell.
import { TeacherLayoutShell } from "@/components/teacher/teacher-layout-shell";

/**
 * Espace enseignant (lot ID-T-F-1). Pas d'AcademicYearProvider ici : il lit
 * l'année active par une route d'administration, refusée à un enseignant.
 */
export default function TeacherLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <TeacherLayoutShell>{children}</TeacherLayoutShell>;
}
