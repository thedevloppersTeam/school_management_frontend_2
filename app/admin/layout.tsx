// app/admin/layout.tsx
// Server Component — toute l'interactivité est déléguée à AdminLayoutShell
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
