import { SchoolLogo } from "@/components/school/layout/school-logo"
import { CheckIcon } from "lucide-react"

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function LoginLayout({ children }: AuthLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #FAFAF8 0%, rgba(240, 235, 223, 0.3) 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
          alignItems: "center",
        }}
      >
        {/* ── Colonne Gauche — Branding ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px",
          }}
        >
          <SchoolLogo size="lg" />

          <div style={{ marginTop: "32px", marginBottom: "32px" }}>
            <h1
              className="font-serif"
              style={{
                color: "#2A3740",
                marginBottom: "12px",
                fontSize: "24px",
                lineHeight: 1.3,
                letterSpacing: "-0.02em",
                fontWeight: 600,
              }}
            >
              Plateforme de Gestion Scolaire
            </h1>
            <p
              className="font-sans"
              style={{ color: "#78756F", fontSize: "14px", lineHeight: 1.6, fontWeight: 400 }}
            >
              Solution complète pour la gestion des bulletins, notes et performances académiques.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {[
              { title: "Gestion Complète",         desc: "Élèves, classes, notes et bulletins en un seul endroit" },
              { title: "Bulletins Professionnels",  desc: "Génération automatique de bulletins PDF conformes" },
              { title: "Sécurité des Données",      desc: "Protection et sauvegarde des données scolaires" },
            ].map((item) => (
              <div key={item.title} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    width: "32px", height: "32px",
                    backgroundColor: "#5A7085",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CheckIcon style={{ width: "16px", height: "16px", color: "white" }} />
                </div>
                <div>
                  <h3
                    className="font-sans"
                    style={{ color: "#1E1A17", marginBottom: "2px", fontSize: "15px", fontWeight: 600 }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="font-sans"
                    style={{ color: "#78756F", fontSize: "13px", fontWeight: 400 }}
                  >
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Colonne Droite — Formulaire ── */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: "100%", maxWidth: "420px" }}>
            {children}
          </div>
        </div>

      </div>
    </div>
  )
}