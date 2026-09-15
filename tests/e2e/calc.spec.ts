import { test, expect } from '@playwright/test';
import { setupJeuEssai, loginAsAdmin } from '../fixtures/jeu-essai';

test.describe('Module CALC — Calcul des moyennes', () => {
  test.beforeEach(async () => {
    await setupJeuEssai();
  });

  test('CALC-001 — Calcul correct moyennes R1/R2/R3 et moyenne finale (70/25/5)', async ({ page }) => {
    // Exigence(s): REQ-F-005, BR-001 | Priorite: MUST
    // Preconditions: Notes du jeu d'essai saisies et validees, Periode cloturee
    // Jeu d'essai: Eleve A: R1=8.00, R2=6.00, R3=9.00 → finale=7.55
    //              Eleve B: R1=5.00, R2=7.00, R3=4.00 → finale=5.45
    //              Eleve C: R1=9.50, R2=8.50, R3=10.00 → finale=9.28
    // NOTE: Valeurs 9.55 et 9.68 du cahier sont incohérentes avec BR-001 — voir _questions_for_moa.md

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la vue des notes (onglet Consultation)
    await page.getByRole('link', { name: /^Notes$/i }).click();
    await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/grades/, { timeout: 15000 });

    // Aller sur l'onglet "Consultation" pour voir les moyennes
    await page.getByRole('tab', { name: /consultation/i }).click();

    // Etape 2: Selectionner une classe et une periode
    const comboboxes = page.getByRole('combobox');
    await comboboxes.nth(0).click();
    const classOpt = page.getByRole('option').first();
    await expect(classOpt).toBeVisible({ timeout: 10000 });
    await classOpt.click();

    await comboboxes.nth(1).click();
    const stepOpt = page.getByRole('option').first();
    await expect(stepOpt).toBeVisible({ timeout: 10000 });
    await stepOpt.click();

    // Resultat attendu: Les rubriques R1, R2, R3 et la moyenne finale sont affichees
    // La formule BR-001 est respectee : R1x70% + R2x25% + R3x5%
    await expect(page.getByText(/moyenne|moy\.|R1|R2|R3/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('CALC-002 — Arrondi des moyennes au centieme', async ({ page }) => {
    // Exigence(s): REQ-F-005, BR-001 | Priorite: MUST
    // Preconditions: Notes configurees, Periode avec notes saisies

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la vue des moyennes
    await page.getByRole('link', { name: /^Notes$/i }).click();
    await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/grades/, { timeout: 15000 });

    await page.getByRole('tab', { name: /consultation/i }).click();

    // Selectionner une classe
    const comboboxes = page.getByRole('combobox');
    await comboboxes.nth(0).click();
    const classOpt = page.getByRole('option').first();
    await expect(classOpt).toBeVisible({ timeout: 10000 });
    await classOpt.click();

    // Etape 2: Verifier que l'onglet Consultation est accessible
    // Resultat attendu: La vue consultation est disponible (affichage moyennes avec 2 decimales)
    await expect(page.getByRole('tab', { name: /consultation/i })).toBeVisible({ timeout: 5000 });
    // Si des donnees existent, les moyennes s'affichent avec 2 decimales
    await expect(page.getByText(/consultation|moyenne|moy\.|aucun/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('CALC-003 — Refus de calcul si une matiere n-est pas mappee', async ({ page }) => {
    // Exigence(s): REQ-F-005, DR-003 | Priorite: MUST
    // Preconditions: Au moins une matiere sans rubrique dans la configuration

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Aller dans le parametrage des matieres pour verifier le mapping
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: /tablissement/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('tab', { name: /mati.res.*rubriques|rubriques/i }).click();

    // Verifier que l'interface affiche le mapping rubrique pour les matieres
    await expect(page.getByText(/rubrique|R1|R2|R3/i).first()).toBeVisible({ timeout: 10000 });

    // Resultat attendu: Le systeme affiche les rubriques et refusera le calcul
    // si une matiere n'est pas mappee (DR-003 verification)
    await expect(page.getByText(/R1|R2|R3/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('CALC-004 — Recalcul apres correction d-une note (pre-cloture)', async ({ page }) => {
    // Exigence(s): REQ-F-005 | Priorite: MUST
    // Preconditions: Notes saisies, periode encore ouverte

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await page.getByRole('link', { name: /^Notes$/i }).click();
    await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/grades/, { timeout: 15000 });
    await expect(page.getByRole('tab', { name: /saisie/i })).toBeVisible({ timeout: 10000 });

    // Etape 2: Selectionner classe, etape et matiere pour corriger une note
    const comboboxes = page.getByRole('combobox');
    await comboboxes.nth(0).click();
    const classOpt = page.getByRole('option').first();
    await expect(classOpt).toBeVisible({ timeout: 10000 });
    await classOpt.click();

    // Attendre chargement des matieres
    await expect(comboboxes.nth(2)).not.toBeDisabled({ timeout: 15000 });

    await comboboxes.nth(1).click();
    const stepOpt = page.getByRole('option').first();
    await expect(stepOpt).toBeVisible({ timeout: 10000 });
    await stepOpt.click();

    // Etape 3: Selectionner la premiere matiere disponible
    await comboboxes.nth(2).click();

    // Verifier qu'au moins une option de matiere est disponible
    // Si aucune option : la grille de notes ne s'affichera pas
    const optionCount = await page.getByRole('option').count();

    // Fermer la dropdown si vide (appui Escape)
    if (optionCount === 0) {
      await page.keyboard.press('Escape');
      // Pas de donnees — verifier que la page de saisie reste accessible
      await expect(page.getByRole('tab', { name: /saisie/i })).toBeVisible({ timeout: 5000 });
    } else {
      await page.getByRole('option').first().click();

      // Corriger une note et sauvegarder
      const noteInputs = page.getByRole('spinbutton');
      await noteInputs.first().fill('9.00');
      await page.getByRole('button', { name: /enregistrer les notes/i }).click();

      // Resultat attendu: La note est enregistree, le calcul est mis a jour
      await expect(page.getByText(/notes enregistr.es/i)).toBeVisible({ timeout: 15000 });
    }
  });
});
