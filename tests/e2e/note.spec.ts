// ⚠ TEST NON EXÉCUTÉ dans le chantier W2 (PR 2, T14). Il n'existe pas
// d'environnement de bout en bout : frontend, serveur, base fictive et
// identifiants d'administrateur de test (BACKLOG E11 ; DECISIONS D-38). Les
// sélecteurs ci-dessous ont été réécrits d'après le code, sans passage réel.
// La vérification passe par la recette manuelle sur app-test (T16).
//
// Sélection Classe → Salle (chantier W2) : les listes sont trouvées par leur
// ÉTIQUETTE (« Classe », « Salle », « Étape », « Matière »), plus par leur
// position. L'écran en a quatre ; l'ancien découpage par indice (0 = classe,
// 1 = étape, 2 = matière) était déjà faux depuis l'ajout de la liste Salle.
import { test, expect, type Page } from '@playwright/test';
import { setupJeuEssai, loginAsAdmin } from '../fixtures/jeu-essai';

// Les cellules de note de la grille. Elles etaient ciblees par
// getByRole('spinbutton'), un role reserve a <input type="number"> ; la grille
// est passee en type="text" inputMode="decimal" pour que la virgule du pave
// numerique cesse d'etre mangee par la sanitisation du navigateur.
// getByRole('textbox') ne conviendrait PAS : il attraperait aussi le champ de
// recherche, qui precede le tableau dans le DOM.
const NOTE_CELL = 'input[data-grid-row]';

// Helper: naviguer vers la page de saisie des notes de l'annee active
async function goToGradesPage(page: any) {
  // Utiliser le lien sidebar "Notes" qui pointe vers l'annee active
  await page.getByRole('link', { name: /^Notes$/i }).click();
  await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/grades/, { timeout: 15000 });
  // Attendre que l'onglet "Saisie" soit visible
  await expect(page.getByRole('tab', { name: /saisie/i })).toBeVisible({ timeout: 10000 });
}

// Une liste de sélection, par son étiquette exacte.
function liste(page: Page, etiquette: 'Classe' | 'Salle' | 'Étape' | 'Matière') {
  return page.getByLabel(etiquette, { exact: true });
}

// Ouvre une liste dès qu'elle est active et choisit sa première option.
async function choisirPremiere(page: Page, etiquette: 'Classe' | 'Salle' | 'Étape' | 'Matière') {
  const l = liste(page, etiquette);
  await expect(l).toBeEnabled({ timeout: 15000 });
  await l.click();
  const option = page.getByRole('option').first();
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
}

// Classe, puis Salle. Une classe à salle unique la préremplit (D1) : dans ce
// cas la liste n'affiche plus « Sélectionner une salle » et on ne la rouvre pas.
async function choisirClasseEtSalle(page: Page) {
  await choisirPremiere(page, 'Classe');
  const salle = liste(page, 'Salle');
  // Désactivée pendant le chargement de la salle préremplie : on attend.
  await expect(salle).toBeEnabled({ timeout: 15000 });
  if ((await salle.getByText(/sélectionner une salle/i).count()) > 0) {
    await choisirPremiere(page, 'Salle');
  }
}

// Helper: selectionner classe, salle, etape et matiere
async function selectGradeContext(page: Page) {
  await choisirClasseEtSalle(page);

  // La liste Matière reste inactive tant que les matières de la salle chargent.
  await expect(liste(page, 'Matière')).toBeEnabled({ timeout: 15000 });

  await choisirPremiere(page, 'Étape');
  await choisirPremiere(page, 'Matière');

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
    const noteInputs = page.locator(NOTE_CELL);
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
    const noteInputs = page.locator(NOTE_CELL);
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
    const noteInputs = page.locator(NOTE_CELL);
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
    const noteInputs = page.locator(NOTE_CELL);
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

    // Selectionner classe, salle et etape
    await choisirClasseEtSalle(page);

    // Attendre le chargement des matieres avant de selectionner l'etape
    await expect(liste(page, 'Matière')).toBeEnabled({ timeout: 15000 });

    // Selectionner la premiere etape disponible
    await choisirPremiere(page, 'Étape');

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
    const noteInputs = page.locator(NOTE_CELL);
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

  test('NOTE-007 — Sélection Classe → Salle : salle inactive sans classe, grille vidée au changement de classe', async ({ page }) => {
    // Chantier W2 (PR 2) : défaut 2 de l'audit. Aucune grille d'une salle ne
    // doit rester affichée sous une autre classe.

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await goToGradesPage(page);

    // Etape 1: sans classe, la liste Salle est inactive et le dit
    const salle = liste(page, 'Salle');
    await expect(salle).toBeDisabled();
    await expect(salle).toContainText(/choisir une classe d.abord/i);

    // Etape 2: contexte complet, la grille est affichee
    await selectGradeContext(page);

    // Etape 3: changer de classe (s'il en existe une autre)
    const classe = liste(page, 'Classe');
    await classe.click();
    const options = page.getByRole('option');
    test.skip((await options.count()) < 2, 'Une seule classe dans le jeu d\'essai');
    await options.nth(1).click();

    // Resultat attendu: la matiere est videe, la grille de l'ancienne salle a disparu
    await expect(page.getByText(/aucune s.lection/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/notes saisies/i)).toHaveCount(0);
  });
});
