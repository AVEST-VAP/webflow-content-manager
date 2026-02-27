import { WordingData, ChangeReport, DeploymentReport, SeoChange } from '../types';
import { PAGE_LOAD_DELAY_MS, ATTRIBUTES, DEFAULTS, EMAIL_REGEX, PHONE_REGEX, EXTERNAL_URL_REGEX, SEO_KEY_PREFIX, SEO_FIELDS } from '../utils/constants';

// Type for page items from Webflow API
type PageOrFolder = Awaited<ReturnType<typeof webflow.getAllPagesAndFolders>>[number];

// Type guard for Page (not Folder)
const isPage = (item: PageOrFolder): boolean => item.type === 'Page';

/**
 * Classe principale pour gérer le déploiement de wording sur une page Webflow
 */
export class ContentManager {
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
  validateWordingData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      errors.push('Les données doivent être un objet valide');
      return { valid: false, errors };
    }

    const wordingData = data as Partial<WordingData>;

    if (!wordingData.site_id) {
      errors.push('Champ "site_id" manquant');
    }

    if (!wordingData.version) {
      errors.push('Champ "version" manquant');
    }

    if (!wordingData.content || typeof wordingData.content !== 'object') {
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
  async applyChanges(onKeyProgress?: (key: string) => void): Promise<DeploymentReport> {
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
        onKeyProgress?.(elementInfo.key);
        const newValue = this.wordingData.content[elementInfo.key];

        if (newValue === undefined) {
          missing++;
          warnings.push(`Clé "${elementInfo.key}" non trouvée dans le JSON`);
          continue;
        }

        try {
          // Trouver l'élément correspondant
          let foundElement: typeof allElements[number] | null = null;

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
            try {
              // Tentative 1 : setTextContent standard sur l'élément lui-même
              if (foundElement.textContent === true || ('setTextContent' in foundElement && typeof (foundElement as any).setTextContent === 'function')) {
                oldValue = '';
                await (foundElement as any).setTextContent(newValue);
              }
              // Tentative 2 : Fallback sur setProperties (éléments hybrides/composants)
              else if ('setProperties' in foundElement) {
                await (foundElement as any).setProperties({ text: newValue });
              }
              // Tentative 3 : Vérifier les enfants (Si c'est un Block qui contient du texte)
              else if ('getChildren' in foundElement && typeof (foundElement as any).getChildren === 'function') {
                const children = (foundElement as any).getChildren();
                if (children && children.length > 0) {
                  const firstChild = children[0];
                  if (firstChild.textContent === true || ('setTextContent' in firstChild && typeof firstChild.setTextContent === 'function')) {
                    await firstChild.setTextContent(newValue);
                    // Succès sur l'enfant !
                  } else {
                    throw new Error(`L'enfant de l'élément (Type: ${firstChild.type}) ne supporte pas le texte non plus.`);
                  }
                } else {
                  throw new Error(`L'élément est un Block vide (pas d'enfants sur lesquels écrire).`);
                }
              }
              else {
                throw new Error(`Pas de méthode compatible pour le texte (Type: ${(foundElement as any).type})`);
              }

              // Succès - on enregistre le changement
              changes.push({
                key: elementInfo.key,
                old_value: oldValue,
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'success'
              });
              applied++;

            } catch (err: any) {
              console.log('Text update error:', err);
              failed++;
              const msg = `Impossible de définir le texte pour "${elementInfo.key}": ${err.message}`;
              errors.push(msg);
              changes.push({
                key: elementInfo.key,
                old_value: '',
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'error',
                message: msg
              });
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
          } else if (mode === 'link') {
            // Mode lien auto-détecté : email, téléphone, URL externe, chemin relatif, ou page interne
            if ('setSettings' in foundElement && typeof (foundElement as any).setSettings === 'function') {

              // PRIORITÉ 1 : Email
              if (EMAIL_REGEX.test(newValue)) {
                await (foundElement as any).setSettings('email', { email: newValue });
              }
              // PRIORITÉ 2 : Téléphone
              else if (PHONE_REGEX.test(newValue)) {
                const cleanPhone = newValue.replace(/^tel:/, '').trim();
                await (foundElement as any).setSettings('phone', { phone: cleanPhone });
              }
              // PRIORITÉ 3 : URL externe (http/https) → ouvre dans un nouvel onglet
              else if (EXTERNAL_URL_REGEX.test(newValue)) {
                await (foundElement as any).setSettings('url', { url: newValue, openInNewTab: true });
              }
              // PRIORITÉ 4 : Chemin relatif (commence par /)
              else if (newValue.startsWith('/')) {
                await (foundElement as any).setSettings('url', { url: newValue });
              }
              // PRIORITÉ 5 : Recherche de page interne par nom
              else {
                const pagesAndFolders = await webflow.getAllPagesAndFolders();
                let targetPage = null;

                if (pagesAndFolders) {
                  for (const item of pagesAndFolders) {
                    if (item.type === 'Page') {
                      const name = await item.getName();
                      if (name.toLowerCase() === newValue.toLowerCase()) {
                        targetPage = item;
                        break;
                      }
                    }
                  }
                }

                if (targetPage) {
                  await (foundElement as any).setSettings('page', targetPage);
                } else {
                  // Fallback : URL relative ou autre
                  await (foundElement as any).setSettings('url', { url: newValue });
                }
              }

              changes.push({
                key: elementInfo.key,
                old_value: oldValue,
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'success'
              });
              applied++;

            } else {
              failed++;
              const msg = `L'élément "${elementInfo.key}" ne supporte pas les liens (pas de méthode setSettings)`;
              errors.push(msg);
              changes.push({
                key: elementInfo.key,
                old_value: '',
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'error',
                message: msg
              });
              continue;
            }

          } else if (mode === 'placeholder') {
            // Mode placeholder pour les inputs
            let placeholderSet = false;

            // Méthode 1: setCustomAttribute (pour FormTextInput)
            if (!placeholderSet && 'setCustomAttribute' in foundElement && typeof (foundElement as any).setCustomAttribute === 'function') {
              try {
                await (foundElement as any).setCustomAttribute('placeholder', newValue);
                placeholderSet = true;
              } catch (e) {
                // setCustomAttribute failed, trying next method
              }
            }

            // Méthode 2: setAttribute (pour DOM elements)
            if (!placeholderSet && 'setAttribute' in foundElement && typeof (foundElement as any).setAttribute === 'function') {
              try {
                await (foundElement as any).setAttribute('placeholder', newValue);
                placeholderSet = true;
              } catch (e) {
                // setAttribute failed, trying next method
              }
            }

            // Méthode 3: setSettings (fallback)
            if (!placeholderSet && 'setSettings' in foundElement && typeof (foundElement as any).setSettings === 'function') {
              try {
                await (foundElement as any).setSettings('placeholder', newValue);
                placeholderSet = true;
              } catch (e) {
                // setSettings failed
              }
            }

            if (placeholderSet) {
              changes.push({
                key: elementInfo.key,
                old_value: oldValue,
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'success'
              });
              applied++;
            } else {
              failed++;
              const msg = `L'élément "${elementInfo.key}" ne supporte pas le placeholder (aucune méthode disponible)`;
              errors.push(msg);
              changes.push({
                key: elementInfo.key,
                old_value: '',
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'error',
                message: msg
              });
              continue;
            }

          } else if (mode.startsWith('prop:')) {
            // Mode propriété de composant (ex: prop:Text, prop:Link)
            const propName = mode.replace('prop:', '').trim();

            if ('setProperties' in foundElement && typeof (foundElement as any).setProperties === 'function') {
              try {
                // On tente de définir la propriété directement
                await (foundElement as any).setProperties({ [propName]: newValue });

                changes.push({
                  key: elementInfo.key,
                  old_value: '', // Pas facile de récupérer l'ancienne valeur ici
                  new_value: newValue,
                  element_selector: `[data-wording-key="${elementInfo.key}"]`,
                  status: 'success'
                });
                applied++;

              } catch (err: any) {
                failed++;
                const msg = `Erreur maj propriété "${propName}" sur "${elementInfo.key}": ${err.message}`;
                errors.push(msg);
                changes.push({
                  key: elementInfo.key,
                  old_value: '',
                  new_value: newValue,
                  element_selector: `[data-wording-key="${elementInfo.key}"]`,
                  status: 'error',
                  message: msg
                });
                continue;
              }
            } else {
              failed++;
              const msg = `L'élément "${elementInfo.key}" n'est pas une instance de composant (pas de méthode setProperties)`;
              errors.push(msg);
              changes.push({
                key: elementInfo.key,
                old_value: '',
                new_value: newValue,
                element_selector: `[data-wording-key="${elementInfo.key}"]`,
                status: 'error',
                message: msg
              });
              continue;
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
    onProgress?: (status: { currentPage: string; completed: number; total: number; allPages?: string[] }) => void
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
      seoKeys?: Array<{ field: string; value: string }>;
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
      seoKeys?: Array<{ field: string; value: string }>;
    }> = [];

    const globalUnusedKeys = new Set(Object.keys(this.wordingData.content));

    // Remove all SEO keys from unused tracking (they are not elements)
    const allSeoKeys = this.getAllSeoKeys();
    for (const seoKey of allSeoKeys) {
      globalUnusedKeys.delete(seoKey);
    }

    try {
      // Extraire les pages ciblées depuis les clés du JSON
      const targetPages = this.extractTargetPagesFromKeys();
      const hasTargetPages = targetPages.size > 0;

      // Récupérer toutes les pages et dossiers
      const pagesAndFolders = await webflow.getAllPagesAndFolders();
      const allPages = pagesAndFolders?.filter(isPage) ?? [];

      // Resolve all page names upfront
      const resolvedPages: Array<{ page: PageOrFolder; name: string }> = [];
      for (const page of allPages) {
        let name = '';
        try {
          name = await page.getName();
        } catch {
          try {
            name = await page.getSlug();
          } catch {
            continue;
          }
        }

        if (!hasTargetPages || Array.from(targetPages).some(target => this.isPageMatch(name, target))) {
          resolvedPages.push({ page, name });
        }
      }

      const allPageNames = resolvedPages.map((p) => p.name);

      // Scanner chaque page
      for (let i = 0; i < resolvedPages.length; i++) {
        const { page, name: pageName } = resolvedPages[i];

        // Notifier la progression
        if (onProgress) {
          onProgress({
            currentPage: pageName,
            completed: i,
            total: resolvedPages.length,
            allPages: allPageNames,
          });
        }

        try {
          // Basculer vers la page
          await webflow.switchPage(page as Parameters<typeof webflow.switchPage>[0]);

          // Attendre que le Designer charge la page
          await new Promise(resolve => setTimeout(resolve, PAGE_LOAD_DELAY_MS));

          // Scanner la page
          const preview = await this.previewChanges();

          // Retirer les clés trouvées de la liste des clés non utilisées
          preview.changes.forEach(change => {
            if (change.hasValue) {
              globalUnusedKeys.delete(change.key);
            }
          });

          // Extract SEO keys for this page
          const seoEntries = this.extractSeoKeysForPage(pageName);

          // Ajouter le résultat
          pagesPreviews.push({
            pageName,
            changes: preview.changes,
            missingKeys: preview.missingKeys,
            stats: {
              total: preview.changes.length,
              withValue: preview.changes.filter(c => c.hasValue).length,
              missing: preview.missingKeys.length
            },
            seoKeys: seoEntries.length > 0 ? seoEntries : undefined,
          });

        } catch (error) {
          console.error(`Erreur lors du scan de ${pageName}:`, error);
        }
      }

      // Notifier la fin
      if (onProgress) {
        onProgress({
          currentPage: 'Terminé',
          completed: resolvedPages.length,
          total: resolvedPages.length,
          allPages: allPageNames,
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

    // Correspondance avec tirets/espaces/underscores
    // Ex: "notre-histoire", "notre_histoire" ou "notre histoire" match avec "notrehistoire"
    const withoutSpaces = normalized.replace(/[\s-_]/g, '');
    const targetWithoutSpaces = target.replace(/[\s-_]/g, '');
    if (withoutSpaces === targetWithoutSpaces) return true;

    return false;
  }

  /**
   * Déploie le wording sur toutes les pages du site (ou seulement celles ciblées)
   */
  async deployToAllPages(
    onProgress?: (status: { currentPage: string; completed: number; total: number; currentKey?: string; allPages?: string[] }) => void
  ): Promise<{
    reports: DeploymentReport[];
    seoChanges: SeoChange[];
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
    const allSeoChanges: SeoChange[] = [];
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
      const allPages = pagesAndFolders?.filter(isPage) ?? [];

      // Resolve all page names upfront
      const resolvedPages: Array<{ page: PageOrFolder; name: string }> = [];
      for (const page of allPages) {
        let name = '';
        try {
          name = await page.getName();
        } catch {
          try {
            name = await page.getSlug();
          } catch {
            continue;
          }
        }

        if (!hasTargetPages || Array.from(targetPages).some(target => this.isPageMatch(name, target))) {
          resolvedPages.push({ page, name });
        }
      }

      const allPageNames = resolvedPages.map((p) => p.name);

      // Déployer sur les pages sélectionnées
      for (let i = 0; i < resolvedPages.length; i++) {
        const { page, name: pageName } = resolvedPages[i];

        // Notifier la progression
        if (onProgress) {
          onProgress({
            currentPage: pageName,
            completed: i,
            total: resolvedPages.length,
            allPages: allPageNames,
          });
        }

        try {
          // Basculer vers la page
          await webflow.switchPage(page as Parameters<typeof webflow.switchPage>[0]);

          // Attendre un peu que le Designer charge la page
          await new Promise(resolve => setTimeout(resolve, PAGE_LOAD_DELAY_MS));

          // Appliquer les changements sur cette page
          const report = await this.applyChanges((key) => {
            onProgress?.({ currentPage: pageName, completed: i, total: resolvedPages.length, currentKey: key, allPages: allPageNames });
          });
          report.page_name = pageName;

          // Apply SEO metadata for this page
          const seoEntries = this.extractSeoKeysForPage(pageName);
          if (seoEntries.length > 0) {
            const seoResults = await this.applySeoToPage(page, seoEntries, pageName);
            allSeoChanges.push(...seoResults);
            report.seoChanges = seoResults;
          }

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
          completed: resolvedPages.length,
          total: resolvedPages.length,
          allPages: allPageNames,
        });
      }

      return {
        reports,
        seoChanges: allSeoChanges,
        summary: {
          totalPages: resolvedPages.length,
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
   * Extracts SEO keys from content for a given page name.
   * Keys follow the convention: pageName._seo.field (e.g. home._seo.title)
   * @returns Array of { field, value } entries for this page
   */
  private extractSeoKeysForPage(pageName: string): Array<{ field: string; value: string }> {
    if (!this.wordingData) return [];

    const normalizedPage = pageName.toLowerCase().trim();
    const entries: Array<{ field: string; value: string }> = [];

    for (const [key, value] of Object.entries(this.wordingData.content)) {
      const parts = key.split('.');
      // Expected format: pageName._seo.fieldName
      const seoIdx = parts.indexOf('_seo');
      if (seoIdx === -1) continue;

      // Page prefix is everything before _seo
      const pagePrefix = parts.slice(0, seoIdx).join('.').toLowerCase();
      if (!this.isPageMatch(pageName, pagePrefix)) continue;

      // Field name is everything after _seo
      const field = parts.slice(seoIdx + 1).join('.');
      if (field && value) {
        entries.push({ field, value });
      }
    }

    return entries;
  }

  /**
   * Returns all content keys that are SEO keys (contain ._seo.)
   */
  private getAllSeoKeys(): Set<string> {
    if (!this.wordingData) return new Set();

    const seoKeys = new Set<string>();
    for (const key of Object.keys(this.wordingData.content)) {
      if (key.includes(`${SEO_KEY_PREFIX}`) || key.includes('._seo.')) {
        seoKeys.add(key);
      }
    }
    return seoKeys;
  }

  /**
   * Applies SEO metadata to a Webflow page (title, description)
   */
  private async applySeoToPage(
    page: PageOrFolder,
    seoEntries: Array<{ field: string; value: string }>,
    pageName: string
  ): Promise<SeoChange[]> {
    const results: SeoChange[] = [];

    for (const entry of seoEntries) {
      const methodName = SEO_FIELDS[entry.field];
      if (!methodName) {
        results.push({
          pageName,
          field: entry.field,
          value: entry.value,
          status: 'error',
          message: `Champ SEO "${entry.field}" non supporté`,
        });
        continue;
      }

      try {
        const pageObj = page as unknown as Record<string, unknown>;
        if (methodName in page && typeof pageObj[methodName] === 'function') {
          await (pageObj[methodName] as (val: string) => Promise<void>)(entry.value);
          results.push({ pageName, field: entry.field, value: entry.value, status: 'success' });
        } else {
          results.push({
            pageName,
            field: entry.field,
            value: entry.value,
            status: 'error',
            message: `La méthode ${methodName} n'est pas disponible sur cette page`,
          });
        }
      } catch (err) {
        results.push({
          pageName,
          field: entry.field,
          value: entry.value,
          status: 'error',
          message: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
    }

    return results;
  }

  /**
   * Exporte le rapport de déploiement en JSON
   */
  exportReport(report: DeploymentReport): string {
    return JSON.stringify(report, null, 2);
  }
}
