import { test, expect } from '@playwright/test';
import { setupJeuEssai, loginAsAdmin, JEU_ESSAI } from '../fixtures/jeu-essai';

test.describe('Module AUTH — Authentification', () => {
  test.beforeEach(async () => {
    await setupJeuEssai();
  });

  test('AUTH-001 — Connexion valide avec identifiants corrects', async ({ page }) => {
    // Exigence(s): SR-001 | Priorite: MUST
    await page.goto('/login');
    await page.getByLabel(/nom d'utilisateur/i).fill(JEU_ESSAI.admin.email);
    await page.getByLabel(/mot de passe/i).fill(JEU_ESSAI.admin.password);
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.getByText(/tableau de bord/i)).toBeVisible();
  });

  test('AUTH-002 — Refus de connexion avec mot de passe incorrect', async ({ page }) => {
    // Exigence(s): SR-001 | Priorite: MUST
    await page.goto('/login');
    await page.getByLabel(/nom d'utilisateur/i).fill(JEU_ESSAI.admin.email);
    await page.getByLabel(/mot de passe/i).fill('MauvaisMotDePasse999!');
    await page.getByRole('button', { name: /se connecter/i }).click();
    // Resultat attendu: message d'erreur visible, utilisateur reste sur /login
    // Le backend renvoie "Invalid credentials" (anglais) ou "Identifiants incorrects"
    await expect(
      page.getByText(/identifiants incorrects|invalid credentials|incorrect|erreur/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('AUTH-003 — Deconnexion et invalidation de session', async ({ page }) => {
    // Exigence(s): SR-001 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Ouvrir le menu utilisateur (bouton avec initiales "SA" ou nom "System Administrator")
    const userMenuBtn = page.getByRole('button').filter({ hasText: /administrator|admin|SA/i }).last();
    await userMenuBtn.click();

    // Cliquer sur Deconnexion
    await page.getByText(/d.connexion/i).click();

    // Resultat attendu: redirection vers /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    // Tenter d'acceder directement a une page interne
    await page.goto('/admin/dashboard');

    // L'acces direct par URL est refuse — redirection vers la connexion
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
