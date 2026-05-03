import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

/**
 * URL du backend pour autoriser ses requêtes dans connect-src.
 * En dev : NEXT_PUBLIC_BACKEND_URL ou fallback localhost.
 * En prod : doit être défini dans les env vars.
 *
 * IMPORTANT : si tu changes de backend, mets à jour cette URL ici.
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://apicpmsl.stelloud.cloud";

/**
 * Content Security Policy (CSP) — SEC-A02-001, SEC-A08-001
 *
 * Stratégie :
 *  - default-src 'self' : par défaut, tout vient de notre origine
 *  - script-src 'self' : pas de scripts inline (sauf 'unsafe-eval' en dev pour HMR)
 *  - style-src 'self' 'unsafe-inline' : Tailwind + html2canvas génèrent du inline
 *  - img-src 'self' data: blob: + backend : photos élèves, logo école
 *  - font-src 'self' : fonts self-hosted via next/font (PAS Google Fonts)
 *  - connect-src 'self' + backend : appels API
 *  - frame-ancestors 'none' : anti-clickjacking
 *  - object-src 'none' : pas de plugins (Flash, etc.)
 *  - base-uri 'self' : empêche injection de <base>
 *  - form-action 'self' : les formulaires ne posent que vers notre origine
 *  - upgrade-insecure-requests : force HTTPS sur tous les sous-resources
 */
function buildCSP() {
  const directives = [
    `default-src 'self'`,
    // Scripts : 'unsafe-eval' uniquement en dev (Turbopack/HMR), strict en prod
    isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'self' 'unsafe-inline'`,
    // Styles : 'unsafe-inline' nécessaire pour Tailwind + html2canvas (PDF bulletins)
    `style-src 'self' 'unsafe-inline'`,
    // Images : self + data URIs (pour preview) + blob (pour html2canvas) + backend pour photos
    `img-src 'self' data: blob: ${BACKEND_URL}`,
    // Fonts : self uniquement (next/font self-host les fonts Google)
    `font-src 'self' data:`,
    // Connexions API : self (proxy Next) + backend direct si appelé en client
    `connect-src 'self' ${BACKEND_URL}`,
    // Pas d'iframes du tout (anti-clickjacking)
    `frame-ancestors 'none'`,
    // Pas de plugins externes
    `object-src 'none'`,
    // Empêche manipulation de <base>
    `base-uri 'self'`,
    // Formulaires : posts uniquement vers notre origine
    `form-action 'self'`,
    // Force HTTPS sur tous les sous-resources (en complément de HSTS)
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}

/**
 * Headers de sécurité — SEC-A02-001, SEC-A04-002, SEC-A08-001
 *
 * Référence : OWASP Secure Headers Project
 * https://owasp.org/www-project-secure-headers/
 */
const securityHeaders = [
  // ── CSP : empêche XSS, injection, clickjacking ──────────────────────
  {
    key: "Content-Security-Policy",
    value: buildCSP(),
  },
  // ── HSTS : force HTTPS (1 an, sans subdomains, sans preload pour V1) ─
  // SEC-A04-002. NE PAS ajouter preload sans réfléchir (irréversible !).
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  // ── X-Frame-Options : doublon de frame-ancestors pour vieux navigateurs ─
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // ── X-Content-Type-Options : empêche MIME sniffing (XSS via mauvais Content-Type) ─
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // ── Referrer-Policy : limite info envoyée à des sites externes ─
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // ── Permissions-Policy : désactive APIs sensibles non utilisées ─
  // CPMSL n'utilise ni caméra, ni micro, ni géoloc, ni paiement, etc.
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "sync-xhr=(self)",
      "usb=()",
      "web-share=()",
      "xr-spatial-tracking=()",
      "interest-cohort=()", // FLoC opt-out (privacy)
    ].join(", "),
  },
  // ── X-DNS-Prefetch-Control : pas de DNS prefetch (privacy + perf) ─
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  // ── Cross-Origin-Opener-Policy : isole le contexte de navigation ─
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  // ── Désactive le header X-Powered-By: Next.js ─────────────────────
  // Évite de divulguer la stack (info utile pour attaquant ciblé). [SEC-A02-007]
  poweredByHeader: false,

  // ── Headers de sécurité appliqués à TOUTES les routes ─────────────
  async headers() {
    return [
      {
        // Match toutes les routes (HTML, API, assets dynamiques)
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
