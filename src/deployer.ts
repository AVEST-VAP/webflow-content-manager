import { WordingData, ChangeReport, DeploymentReport } from './types';

/**
 * Classe principale pour gérer le déploiement de wording sur une page Webflow
 */
export class SiteDeployer {
  private wordingData: WordingData | null = null;

  /**
   * Charge les données de wording depuis un JSON
   */
  loadWordingData(data: WordingData): void {
    this.wordingData = data;
  }

  /**
   * Valide le format du JSON de wording
   */
  validateWordingData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.site_id) {
      errors.push('Champ "site_id" manquant');
    }

    if (!data.version) {
      errors.push('Champ "version" manquant');
    }

    if (!data.content || typeof data.content !== 'object') {
      errors.push('Champ "content" manquant ou invalide');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Scanne la page courante pour trouver tous les éléments avec data-wording-key
   */
  async scanPage(): Promise<{
    elements: Array<{ key: string; selector: string; mode: string }>;
    total: number;
  }> {
    try {
      // Récupérer tous les éléments de la page
      const allElements = await webflow.getAllElements();
      const wordingElements: Array<{ key: string; selector: string; mode: string }> = [];

      for (const element of allElements) {
        // Vérifier si l'élément a l'attribut data-wording-key
        if (element.customAttributes === true) {
          const attrs = await element.getAllCustomAttributes();
          if (attrs) {
            const wordingKeyAttr = attrs.find(attr => attr.name === 'data-wording-key');
            const wordingModeAttr = attrs.find(attr => attr.name === 'data-wording-mode');

            if (wordingKeyAttr) {
              wordingElements.push({
                key: wordingKeyAttr.value,
                selector: `[data-wording-key="${wordingKeyAttr.value}"]`,
                mode: wordingModeAttr?.value || 'text'
              });
            }
          }
        }
      }

      return {
        elements: wordingElements,
        total: wordingElements.length
      };
    } catch (error) {
      console.error('Erreur lors du scan de la page:', error);
      return { elements: [], total: 0 };
    }
  }

  /**
   * Prévisualise les changements qui seront appliqués
   */
  async previewChanges(): Promise<{
    changes: Array<{ key: string; hasValue: boolean; newValue?: string }>;
    missingKeys: string[];
    unusedKeys: string[];
  }> {
    if (!this.wordingData) {
      throw new Error('Aucune donnée de wording chargée');
    }

    const { elements } = await this.scanPage();
    const changes: Array<{ key: string; hasValue: boolean; newValue?: string }> = [];
    const missingKeys: string[] = [];
    const unusedKeys = new Set(Object.keys(this.wordingData.content));

    for (const element of elements) {
      const newValue = this.wordingData.content[element.key];

      if (newValue !== undefined) {
        changes.push({
          key: element.key,
          hasValue: true,
          newValue
        });
        unusedKeys.delete(element.key);
      } else {
        changes.push({
          key: element.key,
          hasValue: false
        });
        missingKeys.push(element.key);
      }
    }

    return {
      changes,
      missingKeys,
      unusedKeys: Array.from(unusedKeys)
    };
  }

  /**
   * Applique les changements de wording sur la page
   */
  async applyChanges(): Promise<DeploymentReport> {
    if (!this.wordingData) {
      throw new Error('Aucune donnée de wording chargée');
    }

    const deploymentId = `dep-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const changes: ChangeReport[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    let applied = 0;
    let failed = 0;
    let missing = 0;

    try {
      const { elements } = await this.scanPage();
      const allElements = await webflow.getAllElements();

      for (const elementInfo of elements) {
        const newValue = this.wordingData.content[elementInfo.key];

        if (newValue === undefined) {
          missing++;
          warnings.push(`Clé "${elementInfo.key}" non trouvée dans le JSON`);
          continue;
        }

        try {
          // Trouver l'élément correspondant
          let foundElement: any = null;

          for (const el of allElements) {
            if (el.customAttributes === true) {
              const attrs = await el.getAllCustomAttributes();
              if (attrs) {
                const hasKey = attrs.some(attr =>
                  attr.name === 'data-wording-key' && attr.value === elementInfo.key
                );
                if (hasKey) {
                  foundElement = el;
                  break;
                }
              }
            }
          }

          if (!foundElement) {
            failed++;
            errors.push(`Élément pour la clé "${elementInfo.key}" non trouvé`);
            continue;
          }

          // Appliquer le changement selon le mode
          let oldValue = '';
          const mode = elementInfo.mode;

          if (mode === 'text' || !mode) {
            // Mode texte par défaut
            if (foundElement.textContent === true) {
              // Pour récupérer l'ancienne valeur, on pourrait utiliser une méthode getTextContent si elle existe
              // Pour l'instant on la laisse vide
              oldValue = '';
              await foundElement.setTextContent(newValue);
            } else {
              failed++;
              errors.push(`Impossible de définir le texte pour "${elementInfo.key}"`);
              continue;
            }
          } else if (mode === 'html') {
            // Mode HTML (utiliser avec précaution)
            // Note: L'API Designer pourrait ne pas supporter innerHTML directement
            // Il faudra peut-être utiliser setTextContent pour le texte simple
            warnings.push(`Mode HTML pour "${elementInfo.key}" - utilisation de textContent`);
            if (foundElement.textContent === true) {
              oldValue = '';
              await foundElement.setTextContent(newValue);
            }
          } else if (mode.startsWith('attr:')) {
            // Mode attribut (href, src, alt, etc.)
            const attrName = mode.replace('attr:', '');
            warnings.push(`Mode attribut "${attrName}" pour "${elementInfo.key}" - non encore implémenté`);
            continue;
          }

          applied++;
          changes.push({
            key: elementInfo.key,
            old_value: oldValue,
            new_value: newValue,
            element_selector: elementInfo.selector,
            status: 'success'
          });

        } catch (error) {
          failed++;
          const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
          errors.push(`Erreur lors de la mise à jour de "${elementInfo.key}": ${errorMsg}`);

          changes.push({
            key: elementInfo.key,
            old_value: '',
            new_value: newValue,
            element_selector: elementInfo.selector,
            status: 'error',
            message: errorMsg
          });
        }
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      errors.push(`Erreur globale: ${errorMsg}`);
    }

    return {
      deployment_id: deploymentId,
      site_id: this.wordingData.site_id,
      timestamp,
      page_name: 'Page courante', // On pourrait récupérer le nom via l'API
      changes,
      warnings,
      errors,
      stats: {
        total_keys: changes.length + missing,
        applied,
        failed,
        missing
      }
    };
  }

  /**
   * Scanne toutes les pages ciblées pour prévisualiser les changements
   */
  async scanAllPages(
    onProgress?: (status: { currentPage: string; completed: number; total: number }) => void
  ): Promise<{
    pagesPreviews: Array<{
      pageName: string;
      changes: Array<{ key: string; hasValue: boolean; newValue?: string }>;
      missingKeys: string[];
      stats: {
        total: number;
        withValue: number;
        missing: number;
      };
    }>;
    summary: {
      totalPages: number;
      totalElements: number;
      totalWithValue: number;
      totalMissing: number;
      unusedKeys: string[];
    };
  }> {
    if (!this.wordingData) {
      throw new Error('Aucune donnée de wording chargée');
    }

    const pagesPreviews: Array<{
      pageName: string;
      changes: Array<{ key: string; hasValue: boolean; newValue?: string }>;
      missingKeys: string[];
      stats: {
        total: number;
        withValue: number;
        missing: number;
      };
    }> = [];

    const globalUnusedKeys = new Set(Object.keys(this.wordingData.content));

    try {
      // Extraire les pages ciblées depuis les clés du JSON
      const targetPages = this.extractTargetPagesFromKeys();
      const hasTargetPages = targetPages.size > 0;

      // Récupérer toutes les pages et dossiers
      const pagesAndFolders = await webflow.getAllPagesAndFolders();
      let allPages = pagesAndFolders?.filter((item: any): item is any => item.type === 'Page') || [];

      // Filtrer les pages si on a des cibles spécifiques
      let pagesToProcess = allPages;
      if (hasTargetPages) {
        const pagesToProcessTemp: any[] = [];

        for (const page of allPages) {
          let pageName = '';
          try {
            pageName = await page.getName();
          } catch {
            try {
              pageName = await page.getSlug();
            } catch {
              continue;
            }
          }

          // Vérifier si cette page correspond à une cible
          const isTarget = Array.from(targetPages).some(target =>
            this.isPageMatch(pageName, target)
          );

          if (isTarget) {
            pagesToProcessTemp.push(page);
          }
        }

        pagesToProcess = pagesToProcessTemp;
      }

      // Scanner chaque page
      for (let i = 0; i < pagesToProcess.length; i++) {
        const page = pagesToProcess[i];

        // Récupérer le nom de la page
        let pageName = 'Page inconnue';
        try {
          pageName = await page.getName();
        } catch (err) {
          try {
            pageName = await page.getSlug();
          } catch {
            pageName = 'Page inconnue';
          }
        }

        // Notifier la progression
        if (onProgress) {
          onProgress({
            currentPage: pageName,
            completed: i,
            total: pagesToProcess.length
          });
        }

        try {
          // Basculer vers la page
          await webflow.switchPage(page);

          // Attendre que le Designer charge la page
          await new Promise(resolve => setTimeout(resolve, 500));

          // Scanner la page
          const preview = await this.previewChanges();

          // Retirer les clés trouvées de la liste des clés non utilisées
          preview.changes.forEach(change => {
            if (change.hasValue) {
              globalUnusedKeys.delete(change.key);
            }
          });

          // Ajouter le résultat
          pagesPreviews.push({
            pageName,
            changes: preview.changes,
            missingKeys: preview.missingKeys,
            stats: {
              total: preview.changes.length,
              withValue: preview.changes.filter(c => c.hasValue).length,
              missing: preview.missingKeys.length
            }
          });

        } catch (error) {
          console.error(`Erreur lors du scan de ${pageName}:`, error);
        }
      }

      // Notifier la fin
      if (onProgress) {
        onProgress({
          currentPage: 'Terminé',
          completed: pagesToProcess.length,
          total: pagesToProcess.length
        });
      }

      // Calculer les statistiques globales
      const totalElements = pagesPreviews.reduce((sum, p) => sum + p.stats.total, 0);
      const totalWithValue = pagesPreviews.reduce((sum, p) => sum + p.stats.withValue, 0);
      const totalMissing = pagesPreviews.reduce((sum, p) => sum + p.stats.missing, 0);

      return {
        pagesPreviews,
        summary: {
          totalPages: pagesPreviews.length,
          totalElements,
          totalWithValue,
          totalMissing,
          unusedKeys: Array.from(globalUnusedKeys)
        }
      };
    } catch (error) {
      throw new Error(`Erreur lors du scan multi-pages: ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    }
  }

  /**
   * Extrait les noms de pages ciblées depuis les clés du JSON
   * Ex: "home.hero_title" → "home"
   */
  private extractTargetPagesFromKeys(): Set<string> {
    if (!this.wordingData) {
      return new Set();
    }

    const targetPages = new Set<string>();

    for (const key of Object.keys(this.wordingData.content)) {
      // Si la clé contient un point, le premier segment est le nom de la page
      if (key.includes('.')) {
        const pageName = key.split('.')[0].toLowerCase();
        targetPages.add(pageName);
      }
    }

    return targetPages;
  }

  /**
   * Normalise un nom de page pour la comparaison
   * Ex: "Notre histoire" → "notre histoire", "Home" → "home"
   */
  private normalizePageName(pageName: string): string {
    return pageName.toLowerCase().trim();
  }

  /**
   * Vérifie si une page correspond à un nom cible
   */
  private isPageMatch(pageName: string, targetPageName: string): boolean {
    const normalized = this.normalizePageName(pageName);
    const target = targetPageName.toLowerCase();

    // Correspondance exacte
    if (normalized === target) return true;

    // Correspondance avec tirets/espaces
    // Ex: "notre-histoire" ou "notre histoire" match avec "notrehistoire"
    const withoutSpaces = normalized.replace(/[\s-]/g, '');
    const targetWithoutSpaces = target.replace(/[\s-]/g, '');
    if (withoutSpaces === targetWithoutSpaces) return true;

    return false;
  }

  /**
   * Déploie le wording sur toutes les pages du site (ou seulement celles ciblées)
   */
  async deployToAllPages(
    onProgress?: (status: { currentPage: string; completed: number; total: number }) => void
  ): Promise<{
    reports: DeploymentReport[];
    summary: {
      totalPages: number;
      successPages: number;
      totalApplied: number;
      totalFailed: number;
      totalMissing: number;
    };
  }> {
    if (!this.wordingData) {
      throw new Error('Aucune donnée de wording chargée');
    }

    const reports: DeploymentReport[] = [];
    let totalApplied = 0;
    let totalFailed = 0;
    let totalMissing = 0;
    let successPages = 0;

    try {
      // Extraire les pages ciblées depuis les clés du JSON
      const targetPages = this.extractTargetPagesFromKeys();
      const hasTargetPages = targetPages.size > 0;

      // Récupérer toutes les pages et dossiers
      const pagesAndFolders = await webflow.getAllPagesAndFolders();
      let allPages = pagesAndFolders?.filter((item: any): item is any => item.type === 'Page') || [];

      // Filtrer les pages si on a des cibles spécifiques
      let pagesToProcess = allPages;
      if (hasTargetPages) {
        const pagesToProcessTemp: any[] = [];

        for (const page of allPages) {
          let pageName = '';
          try {
            pageName = await page.getName();
          } catch {
            try {
              pageName = await page.getSlug();
            } catch {
              continue;
            }
          }

          // Vérifier si cette page correspond à une cible
          const isTarget = Array.from(targetPages).some(target =>
            this.isPageMatch(pageName, target)
          );

          if (isTarget) {
            pagesToProcessTemp.push(page);
          }
        }

        pagesToProcess = pagesToProcessTemp;
      }

      // Déployer sur les pages sélectionnées
      for (let i = 0; i < pagesToProcess.length; i++) {
        const page = pagesToProcess[i];

        // Récupérer le nom de la page via l'API
        let pageName = 'Page inconnue';
        try {
          // Utiliser getName() pour obtenir le vrai nom de la page
          pageName = await page.getName();
        } catch (err) {
          // Fallback sur le slug si getName échoue
          try {
            pageName = await page.getSlug();
          } catch {
            pageName = 'Page inconnue';
          }
        }

        // Notifier la progression
        if (onProgress) {
          onProgress({
            currentPage: pageName,
            completed: i,
            total: pagesToProcess.length
          });
        }

        try {
          // Basculer vers la page
          await webflow.switchPage(page);

          // Attendre un peu que le Designer charge la page
          await new Promise(resolve => setTimeout(resolve, 500));

          // Appliquer les changements sur cette page
          const report = await this.applyChanges();
          report.page_name = pageName;

          reports.push(report);

          // Compter les stats
          totalApplied += report.stats.applied;
          totalFailed += report.stats.failed;
          totalMissing += report.stats.missing;

          if (report.stats.applied > 0 && report.stats.failed === 0) {
            successPages++;
          }
        } catch (error) {
          console.error(`Erreur sur la page ${pageName}:`, error);
          // Continuer avec les autres pages même si une échoue
        }
      }

      // Notifier la fin
      if (onProgress) {
        onProgress({
          currentPage: 'Terminé',
          completed: pagesToProcess.length,
          total: pagesToProcess.length
        });
      }

      return {
        reports,
        summary: {
          totalPages: pagesToProcess.length,
          successPages,
          totalApplied,
          totalFailed,
          totalMissing
        }
      };
    } catch (error) {
      throw new Error(`Erreur lors du déploiement multi-pages: ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    }
  }

  /**
   * Exporte le rapport de déploiement en JSON
   */
  exportReport(report: DeploymentReport): string {
    return JSON.stringify(report, null, 2);
  }
}
