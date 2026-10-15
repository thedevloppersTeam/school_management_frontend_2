/**
 * Jeu d'essai des tests E2E.
 *
 * IDENTIFIANTS : jamais dans ce depot (il est PUBLIC). Definir avant de lancer
 * les tests :
 *   E2E_ADMIN_USERNAME   nom d'utilisateur du compte administrateur de test
 *   E2E_ADMIN_PASSWORD   son mot de passe
 *
 * CIBLE : uniquement une base LOCALE. Les tests refusent de s'executer si le
 * backend n'est pas sur localhost ou 127.0.0.1 (voir assertLocalTarget) :
 *   BACKEND_URL               obligatoire, local (lu par les route handlers)
 *   NEXT_PUBLIC_BACKEND_URL   facultatif ; s'il est defini, local aussi
 * Sans BACKEND_URL, next.config.mjs retombe sur le backend de PRODUCTION :
 * les tests s'arretent avant toute navigation.
 */
import { test, type Page } from '@playwright/test';

// Annexe B du cahier de recette — jeu d'essai recommande
export const JEU_ESSAI = {
  annee: {
    libelle: '2025-2026',
    periodes: ['T1', 'T2', 'T3'],
  },
  classes: [
    { nom: 'Classe-A', filiere: 'LLA' },
    { nom: 'Classe-B', filiere: 'SES' },
  ],
  filieres: ['LLA', 'SES', 'SMP', 'SVT'],
  matieres: [
    { nom: 'Francais', rubrique: 'R1' },
    { nom: 'Maths', rubrique: 'R1' },
    { nom: 'Anglais', rubrique: 'R2' },
    { nom: 'Histoire', rubrique: 'R2' },
    { nom: 'Sport', rubrique: 'R3' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Garde-fou : cible locale uniquement
// ─────────────────────────────────────────────────────────────────────────────

const HOTES_LOCAUX = ['localhost', '127.0.0.1'];

function hoteLocal(variable: string, valeur: string | undefined): void {
  if (!valeur) {
    throw new Error(
      `[e2e] ${variable} n'est pas defini : l'hote du backend ne peut pas etre determine. ` +
      `Sans lui, next.config.mjs retombe sur le backend de production. Tests arretes.`,
    );
  }
  let hote: string;
  try {
    hote = new URL(valeur).hostname;
  } catch {
    throw new Error(`[e2e] ${variable} n'est pas une URL lisible. Tests arretes.`);
  }
  if (!HOTES_LOCAUX.includes(hote)) {
    throw new Error(
      `[e2e] ${variable} vise l'hote « ${hote} ». Les tests ne tournent que contre ` +
      `${HOTES_LOCAUX.join(' ou ')}. Tests arretes.`,
    );
  }
}

/**
 * Refuse de continuer si les tests peuvent atteindre autre chose qu'une
 * instance locale : le frontend teste (baseURL de playwright.config.ts) et le
 * backend vers lequel il relaie (memes variables, meme priorite que
 * next.config.mjs).
 *
 * Ne verifie que l'environnement de CE processus : il n'est fiable que si le
 * serveur Next est lance par Playwright, qui lui transmet cet environnement
 * (d'ou reuseExistingServer: false dans playwright.config.ts).
 */
export function assertLocalTarget(): void {
  hoteLocal('baseURL (playwright.config.ts)', test.info().project.use.baseURL);
  if (process.env.NEXT_PUBLIC_BACKEND_URL !== undefined) {
    hoteLocal('NEXT_PUBLIC_BACKEND_URL', process.env.NEXT_PUBLIC_BACKEND_URL);
  }
  hoteLocal('BACKEND_URL', process.env.BACKEND_URL);
}

/**
 * Identifiants de l'administrateur de test, lus dans l'environnement.
 * Verifie la cible AVANT de rendre quoi que ce soit : un identifiant n'est
 * jamais saisi ailleurs qu'en local. Leve une erreur qui nomme la variable
 * manquante, jamais une valeur.
 */
export function getAdminCredentials(): { username: string; password: string } {
  assertLocalTarget();
  const manquantes = ['E2E_ADMIN_USERNAME', 'E2E_ADMIN_PASSWORD'].filter((v) => !process.env[v]);
  if (manquantes.length > 0) {
    throw new Error(`[e2e] Variable(s) d'environnement manquante(s) : ${manquantes.join(', ')}.`);
  }
  return {
    username: process.env.E2E_ADMIN_USERNAME as string,
    password: process.env.E2E_ADMIN_PASSWORD as string,
  };
}

/**
 * Setup complet du jeu d'essai selon Annexe B du cahier de recette.
 * Appele dans le beforeEach de chaque test E2E : c'est lui qui arrete un test
 * dont la cible n'est pas locale, avant toute navigation.
 */
export async function setupJeuEssai(): Promise<void> {
  assertLocalTarget();
  // Placeholder a implementer quand les APIs de seed sont pretes.
}

/**
 * Helper de login admin reutilisable dans tous les tests E2E.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const { username, password } = getAdminCredentials();
  await page.goto('/login');
  await page.getByLabel(/nom d'utilisateur/i).fill(username);
  await page.getByLabel(/mot de passe/i).fill(password);
  await page.getByRole('button', { name: /se connecter/i }).click();
}
