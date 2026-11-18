// app/teacher/dashboard/page.tsx
// Client Component : « Mon compte » de l'enseignant (lot ID-T-F-1, D-TF1-1).
"use client";

import { LockIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompteEnseignant } from "@/components/teacher/teacher-layout-shell";
import { libelleDuRole } from "@/lib/garde/espace";

/**
 * Seule donnée affichée : le compte connecté, lu dans /me par la coque. Aucune
 * route d'administration, aucun élève : les affectations n'ont pas encore de
 * route serveur pour l'enseignant (BACKLOG ID-T-F-2).
 */
export default function TeacherDashboardPage() {
  const { compte, ouvrirMonCompte } = useCompteEnseignant();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="font-serif text-2xl font-bold text-foreground">Mon compte</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {compte.firstname} {compte.lastname}
          </CardTitle>
          <CardDescription>{libelleDuRole(compte)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Identifiant</dt>
            <dd className="font-medium text-foreground">{compte.username}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => ouvrirMonCompte("profile")}>
              <UserIcon className="mr-2 h-4 w-4" />
              Modifier mon profil
            </Button>
            <Button variant="outline" onClick={() => ouvrirMonCompte("password")}>
              <LockIcon className="mr-2 h-4 w-4" />
              Changer mon mot de passe
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mes affectations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucune affectation à afficher pour l&apos;instant.</p>
        </CardContent>
      </Card>
    </div>
  );
}
