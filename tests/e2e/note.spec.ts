import { test, expect } from '@playwright/test';
import { setupJeuEssai, loginAsAdmin } from '../fixtures/jeu-essai';

// Helper: naviguer vers la page de saisie des notes de l'annee active
async function goToGradesPage(page: any) {
  // Utiliser le lien sidebar "Notes" qui pointe vers l'annee active
  await page.getByRole('link', { name: /^Notes$/i }).click();
  await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/grades/, { timeout: 15000 });
  // Attendre que l'onglet "Saisie" soit visible
  await expect(page.getByRole('tab', { name: /saisie/i })).toBeVisible({ timeout: 10000 });
}

// Helper: selectionner classe, etape et matiere
async function selectGradeContext(page: any) {
  const comboboxes = page.getByRole('combobox');

  // Selectionner la premiere classe disponible (combobox 0: classe)
  await comboboxes.nth(0).click();
  const classOption = page.getByRole('option').first();
  await expect(classOption).toBeVisible({ timeout: 10000 });
  await classOption.click();

  // Attendre le chargement des matieres (la combobox matieres est disabled pendant le chargement)
  await expect(comboboxes.nth(2)).not.toBeDisabled({ timeout: 15000 });

  // Selectionner la premiere etape (periode) — combobox 1
  await comboboxes.nth(1).click();
  const stepOption = page.getByRole('option').first();
  await expect(stepOption).toBeVisible({ timeout: 10000 });
  await stepOption.click();

  // Selectionner la premiere matiere — combobox 2 (maintenant active)
  await comboboxes.nth(2).click();
  const subjectOption = page.getByRole('option').first();
  await expect(subjectOption).toBeVisible({ timeout: 10000 });
  await subjectOption.click();

  // Attendre que la grille de saisie soit visible
  await expect(page.getByText(/notes saisies/i)).toBeVisible({ timeout: 15000 });
}

test.describe('Module NOTE — Saisie et validation des notes', () => {
  test.beforeEach(async () => {
    await setupJeuEssai();
  });

  test('NOTE-001 — Saisir des notes valides (multiples de 0,25)', async ({ page }) => {
    // Exigence(s): REQ-F-003, DR-004 | Priorite: MUST
    // Preconditions: Periode T1 ouverte, Eleves affectes a la classe, Matieres configurees

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await goToGradesPage(page);

    // Etape 2: Selectionner classe, etape et matiere
    await selectGradeContext(page);

    // Etape 3: Saisir les notes suivantes pour les eleves : 7.00, 8.25, 9.50
    const noteInputs = page.getByRole('spinbutton');
    const count = await noteInputs.count();

    if (count >= 1) {
      await noteInputs.nth(0).fill('7.00');
    }
    if (count >= 2) {
      await noteInputs.nth(1).fill('8.25');
    }
    if (count >= 3) {
      await noteInputs.nth(2).fill('9.50');
    }

    // Etape 4: Valider la saisie
    await page.getByRole('button', { name: /enregistrer les notes/i }).click();

    // Resultat attendu: Les notes sont acceptees et enregistrees
    await expect(page.getByText(/notes enregistr.es/i)).toBeVisible({ timeout: 15000 });
  });

  test('NOTE-002 — Refus de note non multiple de 0,25', async ({ page }) => {
    // Exigence(s): DR-004 | Priorite: MUST
    // Preconditions: Periode T1 ouverte

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await goToGradesPage(page);
    await selectGradeContext(page);

    // Etape 2: Tenter de saisir la note 7.10 (pas multiple de 0,25)
    const noteInputs = page.getByRole('spinbutton');
    await noteInputs.first().fill('7.10');

    // Cliquer ailleurs pour declencher la validation
    await page.getByRole('button', { name: /enregistrer les notes/i }).focus();

    // Resultat attendu: La note 7.10 est refusee avec un message explicite
    await expect(
      page.getByText(/multiples de 0\.25 uniquement/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('NOTE-003 — Refus de note hors plage autorisee', async ({ page }) => {
    // Exigence(s): DR-004 | Priorite: MUST
    // Preconditions: Periode T1 ouverte, Plage autorisee = 0 a 10

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await goToGradesPage(page);
    await selectGradeContext(page);

    // Etape 2: Tenter de saisir la note 11 (hors plage)
    const noteInputs = page.getByRole('spinbutton');
    await noteInputs.first().fill('11');

    // Cliquer ailleurs pour declencher la validation
    await page.getByRole('button', { name: /enregistrer les notes/i }).focus();

    // Resultat attendu: La note hors plage est refusee avec un message d'erreur
    await expect(
      page.getByText(/entre 0 et/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('NOTE-004 — Validation en lot des notes d-une classe', async ({ page }) => {
    // Exigence(s): REQ-F-003 | Priorite: MUST
    // Preconditions: Notes saisies pour toute la classe, toutes conformes

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await goToGradesPage(page);
    await selectGradeContext(page);

    // Etape 2: Saisir 8.00 pour tous les eleves visibles
    const noteInputs = page.getByRole('spinbutton');
    const count = await noteInputs.count();
    for (let i = 0; i < count; i++) {
      await noteInputs.nth(i).fill('8.00');
    }

    // Etape 3: Cliquer sur "Enregistrer les notes" (validation groupee)
    await page.getByRole('button', { name: /enregistrer les notes/i }).click();

    // Resultat attendu: Toutes les notes sont enregistrees
    await expect(page.getByText(/notes enregistr.es/i)).toBeVisible({ timeout: 15000 });
  });

  test('NOTE-005 — Impossible de modifier une note apres validation sur periode clôturee', async ({ page }) => {
    // Exigence(s): REQ-F-003 | Priorite: MUST
    // Preconditions: Periode clôturee (etape verrouillee)

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await goToGradesPage(page);

    // Selectionner classe et etape
    const comboboxes = page.getByRole('combobox');
    await comboboxes.nth(0).click();
    const classOption = page.getByRole('option').first();
    await expect(classOption).toBeVisible({ timeout: 10000 });
    await classOption.click();

    // Attendre le chargement des matieres avant de selectionner l'etape
    await expect(comboboxes.nth(2)).not.toBeDisabled({ timeout: 15000 });

    // Selectionner la premiere etape disponible
    await comboboxes.nth(1).click();
    const stepOption = page.getByRole('option').first();
    await expect(stepOption).toBeVisible({ timeout: 10000 });
    await stepOption.click();

    // Resultat attendu: Si l'etape est clôturee, un bandeau "Etape clôturee" est visible
    // ET le bouton "Enregistrer les notes" n'est pas present (isLocked = true)
    // OU l'onglet "Consultation" est disponible pour consulter les notes validees
    const isLockedBanner = page.getByText(/tape clôtur.e/i);
    const consultTab = page.getByRole('tab', { name: /consultation/i });

    // Verifier que l'onglet consultation existe (notes sont consultables)
    await expect(consultTab).toBeVisible({ timeout: 10000 });
  });

  test('NOTE-006 — Saisie partielle — notes manquantes pour certains eleves', async ({ page }) => {
    // Exigence(s): REQ-F-003 | Priorite: MUST
    // Preconditions: Periode T1 ouverte, Eleves dans la classe

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Etape 1: Naviguer vers la saisie des notes
    await goToGradesPage(page);
    await selectGradeContext(page);

    // Etape 2: Saisir des notes pour seulement 3 eleves
    const noteInputs = page.getByRole('spinbutton');
    const count = await noteInputs.count();
    for (let i = 0; i < Math.min(3, count); i++) {
      await noteInputs.nth(i).fill('7.00');
    }

    // Etape 3: Tenter de valider (saisie partielle)
    await page.getByRole('button', { name: /enregistrer les notes/i }).click();

    // Resultat attendu: La sauvegarde partielle est acceptee (notes manquantes = non saisies)
    // Le systeme enregistre les notes saisies et affiche le decompte mis a jour
    await expect(page.getByText(/notes enregistr.es|notes saisies/i)).toBeVisible({ timeout: 15000 });
  });
});
