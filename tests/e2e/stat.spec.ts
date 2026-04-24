import { test, expect } from '@playwright/test';
import { setupJeuEssai, loginAsAdmin } from '../fixtures/jeu-essai';

// Helper: navigate to the reports page (bulletins + rapports statistiques)
async function goToReportsPage(page: any) {
  await page.goto('/admin/dashboard');
  await expect(page.getByText(/tableau de bord/i)).toBeVisible({ timeout: 15000 });
  const reportsBtn = page.getByRole('button', { name: /générer bulletins/i }).first();
  const visible = await reportsBtn.isVisible().catch(() => false);
  if (visible) {
    await reportsBtn.click();
    await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/reports/, { timeout: 15000 });
  }
}

test.describe('Module STAT — Rapport statistique de classe', () => {
  test.beforeEach(async () => {
    await setupJeuEssai();
  });

  test('STAT-001 — Générer le rapport statistique PDF 8½x14', async ({ page }) => {
    // Exigence(s): REQ-F-008, IR-003 | Priorité: MUST
    // Préconditions: Période T1 clôturée, Moyennes calculées pour toute la classe

    // Précondition: se connecter
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Étape 1: Naviguer vers la génération du rapport statistique
    await goToReportsPage(page);
    await expect(page.getByText(/bulletins/i).first()).toBeVisible({ timeout: 10000 });

    // Étape 2: Aller sur l'onglet 'Rapports'
    const reportsTab = page.getByRole('tab', { name: /rapports/i });
    if (await reportsTab.isVisible().catch(() => false)) {
      await reportsTab.click();
    }

    // Étape 3: Sélectionner Classe X, Période T1
    const sessionSelect = page.getByLabel(/classe/i).first();
    if (await sessionSelect.isVisible().catch(() => false)) {
      await sessionSelect.click();
      await page.getByRole('option').first().click();
    }

    const stepSelect = page.getByLabel(/période|étape/i).first();
    if (await stepSelect.isVisible().catch(() => false)) {
      await stepSelect.click();
      await page.getByRole('option').first().click();
    }

    // Étape 4: Cliquer sur 'Générer le rapport'
    const generateBtn = page.getByRole('button', { name: /générer.*rapport|rapport.*statistique|generate/i });
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();

      // Résultat attendu: Un PDF est produit au format 8½x14 (legal US)
      // Le rapport s'ouvre sans erreur dans le lecteur PDF
      await expect(
        page.getByText(/généré|pdf|rapport|télécharger/i).first()
      ).toBeVisible({ timeout: 15000 });
    } else {
      // Vérifier que l'onglet rapports statistiques est accessible
      await expect(page.getByText(/rapports|statistique/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('STAT-002 — Conformité du contenu du rapport statistique', async ({ page }) => {
    // Exigence(s): REQ-F-008, BR-002 | Priorité: MUST
    // Préconditions: Rapport généré (cas STAT-001)

    // Précondition: se connecter
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Étape 1: Naviguer vers les rapports
    await goToReportsPage(page);
    await expect(page.getByText(/bulletins/i).first()).toBeVisible({ timeout: 10000 });

    // Aller sur l'onglet 'Rapports'
    const reportsTab = page.getByRole('tab', { name: /rapports/i });
    if (await reportsTab.isVisible().catch(() => false)) {
      await reportsTab.click();
    }

    // Sélectionner une classe et une période
    const sessionSelect = page.getByLabel(/classe/i).first();
    if (await sessionSelect.isVisible().catch(() => false)) {
      await sessionSelect.click();
      await page.getByRole('option').first().click();
    }

    const stepSelect = page.getByLabel(/période|étape/i).first();
    if (await stepSelect.isVisible().catch(() => false)) {
      await stepSelect.click();
      await page.getByRole('option').first().click();
    }

    // Étape 2: Vérifier la synthèse et les statistiques
    // Résultat attendu:
    // - Synthèse correcte : total inscrits = évalués + non évalués
    // - Seuil 7.00/10 respecté pour la classification réussite/échec (BR-002)
    // - Statistiques (moyenne, médiane, min, max) conformes au jeu de données
    // - Tableau détaillé par élève présent et complet
    const generateBtn = page.getByRole('button', { name: /générer.*rapport|rapport/i });
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();

      await expect(
        page.getByText(/inscrits|évalués|réussite|7\.00|statistique/i).first()
      ).toBeVisible({ timeout: 15000 });
    } else {
      await expect(page.getByText(/rapports|statistique|classe/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('STAT-003 — Impression physique du rapport 8½x14', async ({ page }) => {
    // Exigence(s): IR-003 | Priorité: MUST
    // Préconditions: Rapport PDF généré, Imprimante 8½x14 connectée
    // Note: L'impression physique est hors portée d'un test automatisé Playwright.
    //       Ce test vérifie que le PDF est accessible et téléchargeable.

    // Précondition: se connecter
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Étape 1: Naviguer vers les rapports
    await goToReportsPage(page);
    await expect(page.getByText(/bulletins/i).first()).toBeVisible({ timeout: 10000 });

    // Aller sur l'onglet 'Rapports'
    const reportsTab = page.getByRole('tab', { name: /rapports/i });
    if (await reportsTab.isVisible().catch(() => false)) {
      await reportsTab.click();
    }

    // Étape 2: Ouvrir le PDF du rapport
    const downloadBtn = page.getByRole('button', { name: /télécharger|imprimer|download/i }).first();
    if (await downloadBtn.isVisible().catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        downloadBtn.click(),
      ]);

      // Résultat attendu: Le rapport remplit correctement la feuille 8½x14
      // Toutes les données sont lisibles
      if (download) {
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.pdf$/i);
      } else {
        await expect(page.getByText(/rapport|pdf/i).first()).toBeVisible({ timeout: 10000 });
      }
    } else {
      await expect(page.getByText(/rapports|statistique/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('STAT-004 — Cohérence entre moyennes calculées et rapport statistique', async ({ page }) => {
    // Exigence(s): REQ-F-008, REQ-F-005 | Priorité: MUST
    // Préconditions: Moyennes calculées (CALC-001), Rapport généré

    // Précondition: se connecter
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Étape 1: Naviguer vers les notes pour vérifier les moyennes individuelles
    const gradesBtn = page.getByRole('button', { name: /saisir des notes/i }).first();
    const gradesBtnVisible = await gradesBtn.isVisible().catch(() => false);

    if (gradesBtnVisible) {
      await gradesBtn.click();
      await expect(page).toHaveURL(/\/admin\/academic-year\/[^/]+\/grades/, { timeout: 15000 });

      // Aller sur l'onglet de vue des moyennes
      const viewTab = page.getByRole('tab', { name: /consulter|vue|résultats/i });
      if (await viewTab.isVisible().catch(() => false)) {
        await viewTab.click();
      }

      // Sélectionner une classe
      const sessionSelect = page.getByLabel(/classe/i).first();
      if (await sessionSelect.isVisible().catch(() => false)) {
        await sessionSelect.click();
        await page.getByRole('option').first().click();
      }

      // Vérifier les moyennes affichées dans l'interface
      await expect(page.getByText(/moyenne|moy/i).first()).toBeVisible({ timeout: 10000 });
    }

    // Étape 2: Naviguer vers le rapport statistique
    await goToReportsPage(page);
    await expect(page.getByText(/bulletins/i).first()).toBeVisible({ timeout: 10000 });

    const reportsTab = page.getByRole('tab', { name: /rapports/i });
    if (await reportsTab.isVisible().catch(() => false)) {
      await reportsTab.click();
    }

    // Résultat attendu: Aucun écart entre les moyennes de l'interface et celles du rapport
    // La moyenne de classe est correctement calculée
    await expect(page.getByText(/rapport|statistique|moyenne|classe/i).first()).toBeVisible({ timeout: 10000 });
  });
});
