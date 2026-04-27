/**
 * POST /api/auth/login
 * Proxy → POST https://apicpmsl.stelloud.cloud/api/users/login
 *
 * Authentifie un utilisateur et propage le cookie de session.
 * Body : { username: string, password: string }
 * Public : pas d'auth requise.
 *
 * Note : utilise forwardSetCookie pour propager connect.sid du backend
 * vers le browser (sinon la session ne serait pas créée côté client).
 */
import { NextRequest } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function POST(request: NextRequest) {
  return backendFetch(request, "/api/users/login", "POST", {
    forwardSetCookie: true,
  });
}
