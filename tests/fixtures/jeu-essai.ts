import type { Page } from '@playwright/test';

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
  admin: {
    email: 'admin',
    password: 'Admin@123',
  },
};

/**
 * Setup complet du jeu d'essai selon Annexe B du cahier de recette.
 * Appele dans le beforeEach de chaque test E2E.
 */
export async function setupJeuEssai(): Promise<void> {
  // Placeholder a implementer quand les APIs de seed sont pretes.
  // Le backend externe (apicpmsl.stelloud.cloud) est utilise directement.
}

/**
 * Helper de login admin reutilisable dans tous les tests E2E.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/nom d'utilisateur/i).fill(JEU_ESSAI.admin.email);
  await page.getByLabel(/mot de passe/i).fill(JEU_ESSAI.admin.password);
  await page.getByRole('button', { name: /se connecter/i }).click();
}
