"use client";

import { SchoolLogo } from "@/components/school/school-logo";
import { Toaster } from "@/components/ui/toaster";
import { CheckIcon } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function LoginLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <div
        className="min-h-screen flex items-center justify-center overflow-x-hidden p-6"
        style={{
          // Gradient custom (non couvrable par Tailwind sans config) :
          // neutral-50 -> secondary-100 (transparent)
          background:
            "linear-gradient(135deg, #FAFAF8 0%, rgba(240, 235, 223, 0.3) 100%)",
        }}
      >
        <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-8 items-center">
          {/* ── Colonne Gauche — Branding (lg+) ───────────────────────────── */}
          <div className="hidden lg:flex flex-col justify-center p-12">
            <SchoolLogo size="lg" />

            <div className="mt-8 mb-8">
              {/*
                FIX VH-001 — Cette section descend en h2.
                La page enfant (/login/page.tsx) garde h1 = "Connexion"
                pour qu'il y ait exactement UN h1 par route, comme l'exige WCAG.
              */}
              <h2 className="font-serif text-2xl font-semibold text-primary-800 mb-3 leading-tight tracking-tight">
                Plateforme de Gestion Scolaire
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                Solution complète pour la gestion des bulletins, notes et
                performances académiques.
              </p>
            </div>

            {/* 3 points forts */}
            <div className="flex flex-col gap-5">
              {/* Point 1 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckIcon
                    className="h-4 w-4 text-white"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-sans text-base font-semibold text-neutral-900 mb-0.5">
                    Gestion Complète
                  </h3>
                  <p className="font-sans text-sm text-muted-foreground">
                    Élèves, classes, notes et bulletins en un seul endroit
                  </p>
                </div>
              </div>

              {/* Point 2 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckIcon
                    className="h-4 w-4 text-white"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-sans text-base font-semibold text-neutral-900 mb-0.5">
                    Bulletins Professionnels
                  </h3>
                  <p className="font-sans text-sm text-muted-foreground">
                    Génération automatique de bulletins PDF conformes
                  </p>
                </div>
              </div>

              {/* Point 3 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckIcon
                    className="h-4 w-4 text-white"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h3 className="font-sans text-base font-semibold text-neutral-900 mb-0.5">
                    Sécurité des Données
                  </h3>
                  <p className="font-sans text-sm text-muted-foreground">
                    Protection et sauvegarde des données scolaires
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Colonne Droite — Formulaire ───────────────────────────────── */}
          <div className="w-full flex justify-center">
            <div className="w-full max-w-[420px]">{children}</div>
          </div>
        </div>
      </div>

      <Toaster />
    </>
  );
}
