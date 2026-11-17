import path from "path";
import { fileURLToPath } from "url";
import { resolveBackendUrl } from "./lib/backend-url.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";

/**
 * URL du backend : NEXT_PUBLIC_BACKEND_URL, sinon BACKEND_URL.
 * Aucune valeur par défaut (A11) : sans l'une des deux, le build échoue
 * avec un message explicite. Voir lib/backend-url.mjs et le README.
 *
 * En local : BACKEND_URL=http://localhost:4000
 */
const BACKEND_URL = resolveBackendUrl(process.env);

/**
 * Content Security Policy (CSP)
 */
function buildCSP() {
  const directives = [
    `default-src 'self'`,

    isDev
      ? `script-src 'self' 'unsafe-eval' 'unsafe-inline'`
      : `script-src 'self' 'unsafe-inline'`,

    `style-src 'self' 'unsafe-inline'`,

    /**
     * Images :
     * - 'self' couvre aussi /uploads/* via rewrite Next.js
     * - data/blob utiles pour previews, html2canvas, PDF
     * - BACKEND_URL utile si certaines images sont encore appelées directement
     */
    `img-src 'self' data: blob: ${BACKEND_URL}`,

    `font-src 'self' data:`,

    /**
     * Connexions API :
     * - 'self' pour les routes/proxy Next.js
     * - BACKEND_URL pour les appels directs éventuels vers le backend
     */
    `connect-src 'self' ${BACKEND_URL}`,

    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join("; ");
}

/**
 * Headers de sécurité
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildCSP(),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
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
      "interest-cohort=()",
    ].join(", "),
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
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

  poweredByHeader: false,

  /**
   * Migration du Projet 2 vers Projet 1.
   *
   * Les fichiers statiques uploadés, comme photos élèves, logos, etc.,
   * seront accessibles via :
   *
   * /uploads/...
   *
   * Le navigateur parle à Next.js.
   * Next.js transfère ensuite vers le backend.
   */
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${BACKEND_URL}/uploads/:path*`,
      },
    ];
  },

  /**
   * Headers de sécurité appliqués à toutes les routes.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;