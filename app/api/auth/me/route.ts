/**
 * GET /api/auth/me
 * Proxy → GET https://apicpmsl.stelloud.cloud/api/users/me
 *
 * Retourne les infos de l'utilisateur courant (basé sur le cookie de session).
 * Renvoie 401 si la session est invalide ou expirée.
 */
import { NextRequest } from "next/server";
import { backendFetch } from "@/lib/backend";

export async function GET(request: NextRequest) {
  return backendFetch(request, "/api/users/me", "GET");
}
