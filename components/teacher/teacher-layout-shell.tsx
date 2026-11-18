"use client";

/**
 * Coque de l'espace enseignant (/teacher), lot ID-T-F-1 (D-TF1-1).
 *
 * Sur le modèle d'AdminLayoutShell, en plus court : un seul appel au serveur,
 * GET /api/auth/me, AUCUNE route d'administration (pas d'année active, pas de
 * salles : un enseignant n'y a pas accès). La décision de garde est la fonction
 * pure de lib/garde/espace.ts.
 *
 * La garde est relue à chaque changement de page : une fiche enseignant
 * désactivée par l'administration retire le rôle dès la requête suivante (le
 * serveur répond alors 403 à /me, getMe rend null → /login?expired=1).
 */
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockIcon, LogOutIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SchoolLogo } from "@/components/school/school-logo";
import { ProfileDialog } from "@/components/school/profile-dialog";
import { getMe, logout, type AuthUser } from "@/lib/data/auth-data";
import { ACCUEIL_ENSEIGNANT, decisionDeGarde, libelleDuRole } from "@/lib/garde/espace";
import { appliquerRedirection } from "@/lib/garde/redirection";
import { cn } from "@/lib/utils";

type Onglet = "profile" | "password";

interface CompteEnseignant {
  /** Réponse de /me du compte connecté. */
  compte: AuthUser;
  /** Ouvre le dialogue « Mon compte » sur l'onglet voulu. */
  ouvrirMonCompte: (onglet: Onglet) => void;
}

const CompteEnseignantContext = createContext<CompteEnseignant | null>(null);

/** Compte connecté de l'espace enseignant ; à n'appeler que sous TeacherLayoutShell. */
export function useCompteEnseignant(): CompteEnseignant {
  const valeur = useContext(CompteEnseignantContext);
  if (!valeur) throw new Error("useCompteEnseignant : hors de TeacherLayoutShell");
  return valeur;
}

const liens = [{ label: "Tableau de bord", href: ACCUEIL_ENSEIGNANT }];

export function TeacherLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("profile");

  // Garde de rôle, relue à chaque page. getMe ne rejette jamais (null en cas
  // d'échec) et appliquerRedirection non plus.
  useEffect(() => {
    void getMe().then((user) => {
      const decision = decisionDeGarde("enseignant", user);
      if (decision.action === "rediriger") {
        void appliquerRedirection(decision.vers, decision.fermerLaSession);
        return;
      }
      setCurrentUser(user);
      setAuthLoading(false);
    });
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Au mieux : même si l'appel échoue, on force la sortie locale.
    }
    window.location.href = "/login";
  };

  const ouvrirMonCompte = (o: Onglet) => {
    setOnglet(o);
    setProfileOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const initials = `${currentUser.firstname?.[0] ?? ""}${currentUser.lastname?.[0] ?? ""}`;
  const role = libelleDuRole(currentUser);

  return (
    <CompteEnseignantContext.Provider value={{ compte: currentUser, ouvrirMonCompte }}>
      <a
        href="#contenu-principal"
        className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
      >
        Aller au contenu
      </a>

      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Link href={ACCUEIL_ENSEIGNANT} className="flex items-center gap-2">
            <SchoolLogo size="sm" showText={false} />
            <div className="grid leading-tight">
              <span className="font-serif text-base font-bold text-foreground">CPMSL</span>
              <span className="text-xs text-muted-foreground">Espace enseignant</span>
            </div>
          </Link>

          <nav aria-label="Navigation principale" className="flex items-center gap-1">
            {liens.map((lien) => {
              const actif = pathname === lien.href;
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  aria-current={actif ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                    actif && "bg-muted font-semibold text-foreground",
                  )}
                >
                  {lien.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex h-8 items-center gap-2 pl-2 pr-1">
                <span className="hidden text-sm font-medium sm:inline">{currentUser.firstname}</span>
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-3xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="text-sm font-semibold">
                    {currentUser.firstname} {currentUser.lastname}
                  </p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => ouvrirMonCompte("profile")}>
                <UserIcon className="mr-2 h-4 w-4" />
                Profil / Mon compte
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => ouvrirMonCompte("password")}>
                <LockIcon className="mr-2 h-4 w-4" />
                Changer mot de passe
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogout}
                className="!text-destructive focus:!bg-destructive/10"
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main id="contenu-principal" tabIndex={-1} className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 lg:pt-6">
          {children}
        </main>
      </div>

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={currentUser}
        onProfileUpdated={(updated) => setCurrentUser(updated)}
        ongletInitial={onglet}
      />
    </CompteEnseignantContext.Provider>
  );
}
