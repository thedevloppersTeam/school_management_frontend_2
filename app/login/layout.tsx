"use client"

import { SchoolLogo } from "@/components/school/school-logo"
import { Toaster } from "@/components/ui/toaster"
import { CheckIcon } from "lucide-react"

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function LoginLayout({ children }: AuthLayoutProps) {
  return (
    <>
    <div
      className="min-h-screen flex items-center justify-center overflow-x-hidden"
      style={{
        background: 'linear-gradient(135deg, #FAFAF8 0%, rgba(240, 235, 223, 0.3) 100%)',
        padding: '24px'
      }}
    >
      <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-8 items-center">
        {/* Colonne Gauche - Branding (visible uniquement sur lg+) */}
        <div className="hidden lg:flex flex-col justify-center" style={{ padding: '48px' }}>
          <SchoolLogo size="lg" />

          <div style={{ marginTop: '32px', marginBottom: '32px' }}>
            <h1
              className="font-serif font-semibold"
              style={{
                color: '#2A3740',
                marginBottom: '12px',
                fontSize: '24px',
                lineHeight: '1.3',
                letterSpacing: '-0.02em',
                fontWeight: 600
              }}
            >
              Plateforme de Gestion Scolaire
            </h1>
            <p
              className="font-sans"
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontSize: '14px',
                lineHeight: '1.6',
                fontWeight: 400
              }}
            >
              Solution complète pour la gestion des bulletins, notes et performances académiques.
            </p>
          </div>

          {/* 3 points forts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Point 1 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#5A7085',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CheckIcon style={{ width: '16px', height: '16px', color: 'white' }} />
              </div>
              <div>
                <h3
                  className="font-sans font-semibold"
                  style={{
                    color: '#1E1A17',
                    marginBottom: '2px',
                    fontSize: '15px',
                    fontWeight: 600
                  }}
                >
                  Gestion Complète
                </h3>
                <p
                  className="font-sans text-muted-foreground"
                  style={{
                    fontSize: '13px',
                    fontWeight: 400
                  }}
                >
                  Élèves, classes, notes et bulletins en un seul endroit
                </p>
              </div>
            </div>

            {/* Point 2 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#5A7085',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CheckIcon style={{ width: '16px', height: '16px', color: 'white' }} />
              </div>
              <div>
                <h3
                  className="font-sans font-semibold"
                  style={{
                    color: '#1E1A17',
                    marginBottom: '2px',
                    fontSize: '15px',
                    fontWeight: 600
                  }}
                >
                  Bulletins Professionnels
                </h3>
                <p
                  className="font-sans text-muted-foreground"
                  style={{
                    fontSize: '13px',
                    fontWeight: 400
                  }}
                >
                  Génération automatique de bulletins PDF conformes
                </p>
              </div>
            </div>

            {/* Point 3 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#5A7085',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <CheckIcon style={{ width: '16px', height: '16px', color: 'white' }} />
              </div>
              <div>
                <h3
                  className="font-sans font-semibold"
                  style={{
                    color: '#1E1A17',
                    marginBottom: '2px',
                    fontSize: '15px',
                    fontWeight: 600
                  }}
                >
                  Sécurité des Données
                </h3>
                <p
                  className="font-sans text-muted-foreground"
                  style={{
                    fontSize: '13px',
                    fontWeight: 400
                  }}
                >
                  Protection et sauvegarde des données scolaires
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite - Formulaire */}
        <div className="w-full flex justify-center">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </div>
      </div>
    </div>
    <Toaster />
    </>
  )
}
