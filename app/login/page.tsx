"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon, LoaderIcon } from "lucide-react"
import { getRoleRoute, type UserType } from "@/lib/data/auth-data"
import { useToast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Échec de connexion",
          description: data.message ?? "Identifiants incorrects. Veuillez réessayer.",
        })
        return
      }

      const route = getRoleRoute(data.session?.type as UserType)
      router.push(route)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue. Veuillez réessayer.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #E8E6E3',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          padding: '32px',
          width: '100%'
        }}
      >
        {/* En-tête du formulaire */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            className="font-serif font-bold"
            style={{
              color: '#2A3740',
              marginBottom: '8px',
              fontSize: '28px',
              letterSpacing: '-0.025em',
              fontWeight: 700
            }}
          >
            Connexion
          </h1>
          <p
            className="font-sans text-muted-foreground"
            style={{ fontSize: '13px', fontWeight: 400 }}
          >
            Connectez-vous à votre espace d&apos;administration
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Champ Nom d'utilisateur */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="username"
              className="font-sans"
              style={{ display: 'block', color: '#1E1A17', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}
            >
              Nom d&apos;utilisateur
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="username"
              className="body-base"
              style={{
                width: '100%',
                backgroundColor: 'white',
                border: '1px solid #D1CECC',
                borderRadius: '8px',
                padding: '12px',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5A7085'
                e.target.style.boxShadow = '0 0 0 2px rgba(90, 112, 133, 0.2)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#D1CECC'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Champ Mot de passe */}
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="password"
              className="font-sans"
              style={{ display: 'block', color: '#1E1A17', marginBottom: '6px', fontSize: '13px', fontWeight: 500 }}
            >
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="body-base"
                style={{
                  width: '100%',
                  backgroundColor: 'white',
                  border: '1px solid #D1CECC',
                  borderRadius: '8px',
                  padding: '12px',
                  paddingRight: '40px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#5A7085'
                  e.target.style.boxShadow = '0 0 0 2px rgba(90, 112, 133, 0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#D1CECC'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  const icon = e.currentTarget.querySelector('svg')
                  if (icon) (icon as unknown as HTMLElement).style.color = '#1E1A17'
                }}
                onMouseLeave={(e) => {
                  const icon = e.currentTarget.querySelector('svg')
                  if (icon) (icon as unknown as HTMLElement).style.color = '#78756F'
                }}
              >
                {showPassword ? (
                  <EyeOffIcon style={{ width: '16px', height: '16px', color: '#78756F' }} />
                ) : (
                  <EyeIcon style={{ width: '16px', height: '16px', color: '#78756F' }} />
                )}
              </button>
            </div>
          </div>

          {/* Bouton Se connecter */}
          <button
            type="submit"
            disabled={isLoading}
            className="font-sans"
            style={{
              width: '100%',
              backgroundColor: isLoading ? '#4A5D6E' : '#5A7085',
              color: 'white',
              borderRadius: '8px',
              height: '44px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#4A5D6E'
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#5A7085'
            }}
          >
            {isLoading && (
              <LoaderIcon style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
            )}
            {isLoading ? "Connexion en cours..." : "Se connecter"}
          </button>
        </form>

        {/* Pied de page */}
        <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #E8E6E3' }}>
          <p className="caption" style={{ color: '#A8A5A2', textAlign: 'center', marginBottom: '4px' }}>
            © 2026 Cours Privé Mixte Saint Léonard
          </p>
          <p className="caption" style={{ color: '#A8A5A2', textAlign: 'center' }}>
            Port-au-Prince, Haïti
          </p>
        </div>
      </div>
    </>
  )
}
