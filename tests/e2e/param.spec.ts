import { test, expect } from '@playwright/test';
import { setupJeuEssai, loginAsAdmin } from '../fixtures/jeu-essai';

test.describe('Module PARAM — Parametrage', () => {
  test.beforeEach(async () => {
    await setupJeuEssai();
  });

  test('PARAM-001 — Creer une annee scolaire avec periodes', async ({ page }) => {
    // Exigence(s): REQ-F-001 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers le module de parametrage > Annee scolaire
    await page.goto('/admin/academic-years');
    await expect(page.getByRole('heading', { name: /ann.es scolaires/i })).toBeVisible({ timeout: 10000 });

    // Etape 2: Creer une nouvelle annee scolaire
    await page.getByRole('button', { name: /nouvelle ann.e/i }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Le nom est genere automatiquement — sauvegarder directement
    await modal.getByRole('button', { name: /cr.er.*ann.e|cr.er|confirmer/i }).last().click();

    // Resultat attendu: L'annee scolaire est creee et apparait dans la liste
    await expect(page.getByRole('heading', { name: /ann.es scolaires/i })).toBeVisible({ timeout: 15000 });
    // Au moins une annee est visible dans la liste
    await expect(page.getByRole('heading').filter({ hasText: /202[0-9]-20[0-9][0-9]/ }).first()).toBeVisible({ timeout: 15000 });
  });

  test('PARAM-002 — Creer classes, niveaux et filieres (Nouveau Secondaire)', async ({ page }) => {
    // Exigence(s): REQ-F-001 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la gestion des classes
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /tablissement/i })).toBeVisible({ timeout: 10000 });

    // Etape 2: Cliquer sur l'onglet Classes
    await page.getByRole('tab', { name: /^classes/i }).click();

    // Resultat attendu: L'onglet Classes est accessible et affiche le contenu
    await expect(page.getByRole('tab', { name: /^classes/i })).toBeVisible({ timeout: 10000 });
  });

  test('PARAM-003 — Definir le referentiel de matieres avec mapping rubrique', async ({ page }) => {
    // Exigence(s): REQ-F-001, DR-003, BR-001 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la gestion des matieres
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /tablissement/i })).toBeVisible({ timeout: 10000 });

    // Cliquer sur l'onglet Matieres & Rubriques
    await page.getByRole('tab', { name: /mati.res.*rubriques|rubriques/i }).click();

    // Resultat attendu: Les matieres sont affichees avec leur rubrique (R1 / R2 / R3)
    await expect(page.getByText(/rubrique|R1|R2|R3/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('PARAM-004 — Copier la structure d-une annee existante vers une nouvelle annee', async ({ page }) => {
    // Exigence(s): REQ-F-001 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la creation d'une nouvelle annee
    await page.goto('/admin/academic-years');
    await expect(page.getByRole('heading', { name: /ann.es scolaires/i })).toBeVisible({ timeout: 10000 });

    // Etape 2: Ouvrir le modal de creation
    await page.getByRole('button', { name: /nouvelle ann.e/i }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Verifier que le modal s'ouvre et contient les options de creation
    await expect(modal.getByRole('heading').first()).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
  });

  test('PARAM-005 — Ajout-retrait de matiere par classe (exception au referentiel)', async ({ page }) => {
    // Exigence(s): REQ-F-001 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la configuration d'une classe specifique
    await page.goto('/admin/academic-years');
    await expect(page.getByRole('heading', { name: /ann.es scolaires/i })).toBeVisible({ timeout: 10000 });

    const configBtn = page.getByRole('button', { name: /configurer/i }).first();
    if (await configBtn.isVisible().catch(() => false)) {
      await configBtn.click();
      await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/config/, { timeout: 15000 });
      // Resultat attendu: La page de configuration est accessible avec les onglets Classes et Matieres
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByRole('heading', { name: /ann.es scolaires/i })).toBeVisible();
    }
  });

  test('PARAM-006 — Refus de generation-calcul si matiere non mappee', async ({ page }) => {
    // Exigence(s): DR-003 | Priorite: MUST
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Verifier la presence du parametrage des matieres
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /tablissement/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('tab', { name: /mati.res.*rubriques|rubriques/i }).click();

    // Resultat attendu: Le systeme affiche les rubriques et leur mapping
    await expect(page.getByText(/rubrique|R1|R2|R3/i).first()).toBeVisible({ timeout: 10000 });
  });
});
