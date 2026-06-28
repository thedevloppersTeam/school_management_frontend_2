// lib/upload-url.ts
//
// Photos and logos are served by the Express backend from /uploads/...
// The Next.js app exposes /uploads/* as a rewrite to `${BACKEND_URL}/uploads/*`
// (see next.config.ts), so the browser only ever talks to Next.js — the
// backend's real port is transparent.
//
// Historically the backend stored ABSOLUTE URLs (e.g.
// "http://localhost:4888/uploads/promotion-photos/X.png") built from PORT or
// BASE_URL at upload time. Those URLs break when:
//   - the backend is deployed on a different host
//   - the browser can't reach the embedded host directly
//
// The fix is two-fold:
//   1. The backend now stores RELATIVE paths going forward.
//   2. This helper strips the host from any LEGACY absolute /uploads/ URL so
//      the existing data still displays correctly through the rewrite.
//
// Use it everywhere an upload URL is passed to <img src> or <AvatarImage>.

const ABSOLUTE_UPLOAD = /^https?:\/\/[^/]+(\/uploads\/.+)$/i

export function normalizeUploadUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("/uploads/")) return trimmed
  const match = ABSOLUTE_UPLOAD.exec(trimmed)
  if (match) return match[1]
  // Not an /uploads URL (e.g. an external avatar / data URL) — leave as-is.
  return trimmed
}
