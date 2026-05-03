"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EyeIcon, EyeOffIcon, LoaderIcon } from "lucide-react";
import { getRoleRoute, type UserType } from "@/lib/data/auth-data";
import { useToast } from "@/components/ui/use-toast";
import { clientFetch, ApiError } from "@/lib/client-fetch";
import { toMessage } from "@/lib/errors";

interface LoginResponse {
  session?: {
    type: UserType;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Validation anti open-redirect.
 * Doit être SYNCHRONISÉE avec proxy.ts (même règle).
 *
 * N'autorise que les chemins relatifs commençant par / et pas par //
 * (// ouvrirait une redirection vers un domaine externe).
 *
 * Bloque :
 *  - URLs absolues : https://evil.com
 *  - Protocole-relatif : //evil.com
 *  - Backslash trick : /\evil.com
 *  - javascript: et autres pseudo-protocoles
 */
function isSafeRedirectPath(path: string | null): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  return true;
}

/**
 * Composant interne qui utilise useSearchParams.
 * Doit être wrappé dans <Suspense> car useSearchParams suspend le rendu
 * lors du build statique (Next.js 15+/16 requirement).
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = await clientFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      // ── Préserver la destination originale si présente (?from=...) ──
      // Si l'utilisateur a tenté d'accéder à /admin/archives sans session,
      // proxy.ts l'a redirigé vers /login?from=/admin/archives.
      // Après login, on l'envoie sur la page demandée plutôt que sur le
      // dashboard générique.
      //
      // SÉCURITÉ : isSafeRedirectPath bloque les open redirects (//evil.com,
      // https://, etc.). Si le from est invalide ou absent, fallback sur
      // la route par défaut du rôle (getRoleRoute).
      const from = searchParams.get("from");
      const route = isSafeRedirectPath(from)
        ? from!
        : getRoleRoute(data.session?.type as UserType);

      router.push(route);
    } catch (err) {
      // Titres adaptés au contexte du login
      const titlesByStatus: Record<number, string> = {
        401: "Identifiants incorrects",
        403: "Compte inactif",
        500: "Erreur serveur",
        502: "Service indisponible",
        503: "Service indisponible",
        504: "Serveur lent",
      };

      let title = "Erreur de connexion";
      if (err instanceof ApiError) {
        title = titlesByStatus[err.status] ?? "Échec de connexion";
      } else if (err instanceof TypeError) {
        // fetch failed côté navigateur (réseau coupé, CORS, etc.)
        title = "Erreur réseau";
      }

      toast({
        variant: "destructive",
        title,
        description: toMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Classe partagée pour les inputs : focus visible (A11Y-005), bordure CPMSL,
  // états disabled propres. focus-visible n'apparaît qu'au focus clavier
  // (pas au clic souris) — c'est le standard UX moderne.
  const inputClass =
    "w-full bg-white text-neutral-900 placeholder:text-neutral-500 " +
    "border border-neutral-300 rounded-lg px-3 py-3 " +
    "outline-none transition-all duration-200 " +
    "focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20 " +
    "disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-md p-8 w-full">
      {/* En-tête du formulaire */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-primary-800 mb-2 tracking-tight">
          Connexion
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Connectez-vous à votre espace d&apos;administration
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Champ Nom d'utilisateur */}
        <div>
          <label
            htmlFor="username"
            className="block font-sans text-sm font-medium text-neutral-900 mb-1.5"
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
            suppressHydrationWarning
            className={`body-base ${inputClass}`}
          />
        </div>

        {/* Champ Mot de passe */}
        <div>
          <label
            htmlFor="password"
            className="block font-sans text-sm font-medium text-neutral-900 mb-1.5"
          >
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              suppressHydrationWarning
              className={`body-base pr-10 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              suppressHydrationWarning
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
              className="
                absolute right-3 top-1/2 -translate-y-1/2
                flex items-center justify-center
                bg-transparent border-none cursor-pointer p-0
                text-neutral-500 hover:text-neutral-900
                focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:rounded
                disabled:cursor-not-allowed
              "
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <EyeIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Bouton Se connecter */}
        <button
          type="submit"
          disabled={isLoading}
          className="
            w-full h-11 rounded-lg
            font-sans text-base font-semibold
            flex items-center justify-center gap-2
            bg-primary-500 hover:bg-primary-600 text-white
            transition-colors duration-200
            disabled:bg-primary-600 disabled:cursor-not-allowed
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
          "
        >
          {isLoading && (
            <LoaderIcon
              className="h-4 w-4 animate-spin"
              role="status"
              aria-label="Connexion en cours"
            />
          )}
          {isLoading ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      {/* Pied de page */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <p className="caption text-neutral-500 text-center mb-1">
          © 2026 Cours Privé Mixte Saint Léonard
        </p>
        <p className="caption text-neutral-500 text-center">
          Port-au-Prince, Haïti
        </p>
      </div>
    </div>
  );
}

/**
 * Skeleton affiché pendant la suspension de useSearchParams.
 * Doit avoir la même structure visuelle que LoginForm pour éviter le CLS
 * (Cumulative Layout Shift) lors de la transition skeleton → contenu réel.
 */
function LoginFormSkeleton() {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-md p-8 w-full">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-primary-800 mb-2 tracking-tight">
          Connexion
        </h1>
        <p className="font-sans text-sm text-muted-foreground">
          Connectez-vous à votre espace d&apos;administration
        </p>
      </div>
      <div className="space-y-4 animate-pulse">
        <div>
          <div className="h-4 w-32 bg-neutral-200 rounded mb-1.5" />
          <div className="h-12 bg-neutral-100 rounded-lg" />
        </div>
        <div>
          <div className="h-4 w-24 bg-neutral-200 rounded mb-1.5" />
          <div className="h-12 bg-neutral-100 rounded-lg" />
        </div>
        <div className="h-11 bg-neutral-200 rounded-lg" />
      </div>
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <p className="caption text-neutral-500 text-center mb-1">
          © 2026 Cours Privé Mixte Saint Léonard
        </p>
        <p className="caption text-neutral-500 text-center">
          Port-au-Prince, Haïti
        </p>
      </div>
    </div>
  );
}

/**
 * Page de login.
 *
 * Suspense wrapper REQUIS car useSearchParams() suspend le rendu pendant
 * le build statique (Next.js 15+/16 requirement).
 * @see https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
