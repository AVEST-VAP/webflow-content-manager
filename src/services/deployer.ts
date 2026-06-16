import {
  WordingData,
  ChangeReport,
  DeploymentReport,
  SeoChange,
  Change,
  PagePreview,
  ScanResult,
  ScanProgress,
} from "../types";
import { isSeoKey } from "../utils/wordingKeys";
import {
  PAGE_LOAD_DELAY_MS,
  ATTRIBUTES,
  DEFAULTS,
  EMAIL_REGEX,
  PHONE_REGEX,
  EXTERNAL_URL_REGEX,
  SEO_SEGMENT,
  SEO_FIELDS,
  ELEMENT_WRITE_TIMEOUT_MS,
  WORDING_MODES,
  SINGLE_PAGE_NAME,
} from "../utils/constants";
import { withTimeout } from "../utils/timeout";

// Toggle verbose per-call deploy logging (off in production; flip to true to
// trace which exact Webflow API call is slow or stuck).
const DEBUG_DEPLOY = false;

// Type for page items from Webflow API
type PageOrFolder = Awaited<
  ReturnType<typeof webflow.getAllPagesAndFolders>
>[number];

// Type guard for Page (not Folder)
const isPage = (item: PageOrFolder): item is Page => item.type === "Page";

// An element returned by the Webflow Designer API.
type AnyElement = Awaited<ReturnType<typeof webflow.getAllElements>>[number];

// Structural view of an element's optional write methods. Signatures mirror the
// real Designer API typings (elements-generated.d.ts) so the compiler catches
// misuse; methods are still probed at runtime since the real type is a union.
interface WritableElement {
  type?: string;
  textContent?: boolean;
  setTextContent?: (value: string) => Promise<unknown>;
  setSettings?: (
    mode: "url" | "page" | "pageSection" | "email" | "phone" | "file",
    target: string | Page | AnyElement,
    metadata?: { openInNewTab?: boolean; subject?: string },
  ) => Promise<unknown>;
  setCustomAttribute?: (name: string, value: string) => Promise<unknown>;
  // Attributes mixin (API ≥ 2.1): sets standard HTML attributes (placeholder,
  // value…) that setCustomAttribute rejects as "reserved".
  setAttribute?: (name: string, value: string) => Promise<unknown>;
  // String nodes (type "String") expose setText instead of setTextContent.
  setText?: (text: string) => Promise<unknown>;
  getChildren?: () => Promise<WritableElement[]>;
}

// Result of writing a single element, consumed by applyChanges to build stats.
interface ChangeWriteResult {
  status: "success" | "error" | "skipped";
  change?: ChangeReport;
  warning?: string;
}

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
   * True when the loaded content targets specific pages (keys are dot-prefixed,
   * e.g. "home.hero.title") — i.e. multi-page mode rather than current-page.
   */
  isMultiPage(): boolean {
    return this.extractTargetPagesFromKeys().size > 0;
  }

  /**
   * Valide le format du JSON de wording
   */
  validateWordingData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof data !== "object" || data === null) {
      errors.push("Les données doivent être un objet valide");
      return { valid: false, errors };
    }

    const wordingData = data as Partial<WordingData>;

    if (!wordingData.site_id) {
      errors.push('Champ "site_id" manquant');
    }

    if (!wordingData.version) {
      errors.push('Champ "version" manquant');
    }

    if (!wordingData.content || typeof wordingData.content !== "object") {
      errors.push('Champ "content" manquant ou invalide');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Scanne la page courante pour trouver tous les éléments avec data-wording-key
   */
  async scanPage(): Promise<{
    elements: Array<{
      key: string;
      selector: string;
      mode: string;
      type: string;
    }>;
    total: number;
  }> {
    try {
      // Récupérer tous les éléments de la page
      const allElements = await webflow.getAllElements();
      const wordingElements: Array<{
        key: string;
        selector: string;
        mode: string;
        type: string;
      }> = [];

      for (const element of allElements) {
        // Vérifier si l'élément a l'attribut data-wording-key
        if (element.customAttributes === true) {
          const attrs = await element.getAllCustomAttributes();
          if (attrs) {
            const wordingKeyAttr = attrs.find(
              (attr) => attr.name === ATTRIBUTES.WORDING_KEY,
            );
            const wordingModeAttr = attrs.find(
              (attr) => attr.name === ATTRIBUTES.WORDING_MODE,
            );

            if (wordingKeyAttr) {
              wordingElements.push({
                key: wordingKeyAttr.value,
                selector: `[data-wording-key="${wordingKeyAttr.value}"]`,
                mode: wordingModeAttr?.value || DEFAULTS.WORDING_MODE,
                type: element.type,
              });
            }
          }
        }
      }

      return {
        elements: wordingElements,
        total: wordingElements.length,
      };
    } catch (error) {
      console.error("Erreur lors du scan de la page:", error);
      return { elements: [], total: 0 };
    }
  }

  /**
   * Prévisualise les changements qui seront appliqués
   */
  async previewChanges(): Promise<{
    changes: Change[];
    missingKeys: string[];
    unusedKeys: string[];
  }> {
    if (!this.wordingData) {
      throw new Error("Aucune donnée de wording chargée");
    }

    const { elements } = await this.scanPage();
    const changes: Change[] = [];
    const missingKeys: string[] = [];
    const unusedKeys = new Set(Object.keys(this.wordingData.content));

    for (const element of elements) {
      const newValue = this.wordingData.content[element.key];

      if (newValue !== undefined) {
        changes.push({
          key: element.key,
          hasValue: true,
          newValue,
          type: element.type,
          mode: element.mode,
        });
        unusedKeys.delete(element.key);
      } else {
        changes.push({
          key: element.key,
          hasValue: false,
          type: element.type,
          mode: element.mode,
        });
        missingKeys.push(element.key);
      }
    }

    return {
      changes,
      missingKeys,
      unusedKeys: Array.from(unusedKeys),
    };
  }

  /**
   * Applique les changements de wording sur la page
   */
  async applyChanges(
    onKeyProgress?: (key: string) => void,
  ): Promise<DeploymentReport> {
    if (!this.wordingData) {
      throw new Error("Aucune donnée de wording chargée");
    }

    const deploymentId = `dep-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const changes: ChangeReport[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    let applied = 0;
    let failed = 0;
    let missing = 0;
    let skipped = 0;

    try {
      // Build the data-wording-key → element map ONCE. The previous version
      // re-read every element's custom attributes for every key (O(n²)); here
      // each element is read a single time, and the read is timeout-protected.
      const elementByKey = await this.buildElementKeyMap();

      for (const [key, elements] of elementByKey) {
        onKeyProgress?.(key);

        const newValue = this.wordingData.content[key];
        if (newValue === undefined) {
          // Count every element bearing this key so the report's "missing"
          // matches the preview (which lists one entry per element).
          missing += elements.length;
          warnings.push(`Clé "${key}" non trouvée dans le JSON`);
          continue;
        }

        // A key can be present on several elements of the same page — apply to
        // every one of them, not just the first.
        for (const { element, mode } of elements) {
          const result = await this.writeElement(element, mode, key, newValue);

          if (result.change) {
            changes.push(result.change);
          }
          if (result.status === "success") {
            applied++;
          } else if (result.status === "error") {
            failed++;
            if (result.change?.message) {
              errors.push(result.change.message);
            }
          } else if (result.status === "skipped") {
            skipped++;
          }
          if (result.warning) {
            warnings.push(result.warning);
          }
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erreur inconnue";
      errors.push(`Erreur globale: ${errorMsg}`);
    }

    return {
      deployment_id: deploymentId,
      site_id: this.wordingData.site_id,
      timestamp,
      page_name: SINGLE_PAGE_NAME,
      changes,
      warnings,
      errors,
      stats: {
        total_keys: changes.length + missing + skipped,
        applied,
        failed,
        missing,
        skipped,
      },
    };
  }

  /**
   * Wraps a single Webflow Designer API call with timeout protection. A hanging
   * call (one that never settles) is turned into a rejected promise after
   * ELEMENT_WRITE_TIMEOUT_MS so it can be caught and reported instead of
   * freezing the deployment. Set DEBUG_DEPLOY to trace each call in the console.
   */
  private async safeCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (DEBUG_DEPLOY) console.log(`[deploy] → ${label}`);
    try {
      const result = await withTimeout(fn(), label, ELEMENT_WRITE_TIMEOUT_MS);
      if (DEBUG_DEPLOY) console.log(`[deploy] ✓ ${label}`);
      return result;
    } catch (err) {
      if (DEBUG_DEPLOY) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`[deploy] ✗ ${label}: ${message}`);
      }
      throw err;
    }
  }

  /**
   * Scans the current page once and indexes every element by its
   * data-wording-key (with its mode). Each attribute read is timeout-protected
   * so a single unresponsive element cannot freeze the scan.
   */
  private async buildElementKeyMap(): Promise<
    Map<string, Array<{ element: AnyElement; mode: string }>>
  > {
    const map = new Map<string, Array<{ element: AnyElement; mode: string }>>();
    const allElements = await withTimeout(
      webflow.getAllElements(),
      "getAllElements",
      ELEMENT_WRITE_TIMEOUT_MS,
    );

    for (const el of allElements) {
      if (el.customAttributes !== true) continue;

      try {
        const attrs = await withTimeout(
          el.getAllCustomAttributes(),
          "getAllCustomAttributes",
          ELEMENT_WRITE_TIMEOUT_MS,
        );
        if (!attrs) continue;

        const keyAttr = attrs.find(
          (attr) => attr.name === ATTRIBUTES.WORDING_KEY,
        );
        if (!keyAttr) continue;

        const modeAttr = attrs.find(
          (attr) => attr.name === ATTRIBUTES.WORDING_MODE,
        );
        const entry = {
          element: el,
          mode: modeAttr?.value || DEFAULTS.WORDING_MODE,
        };
        const existing = map.get(keyAttr.value);
        if (existing) {
          existing.push(entry);
        } else {
          map.set(keyAttr.value, [entry]);
        }
      } catch (err) {
        console.warn(
          "[deploy] lecture des attributs ignorée sur un élément:",
          err,
        );
      }
    }

    return map;
  }

  /**
   * Finds a Webflow page by display name (case-insensitive). Timeout-protected.
   */
  private async findPageByName(name: string): Promise<Page | null> {
    const pagesAndFolders = await withTimeout(
      webflow.getAllPagesAndFolders(),
      "getAllPagesAndFolders",
      ELEMENT_WRITE_TIMEOUT_MS,
    );
    if (!pagesAndFolders) return null;

    for (const item of pagesAndFolders) {
      if (!isPage(item)) continue;
      const itemName = await withTimeout(
        item.getName(),
        "page.getName",
        ELEMENT_WRITE_TIMEOUT_MS,
      );
      if (itemName.toLowerCase() === name.toLowerCase()) return item;
    }
    return null;
  }

  /**
   * Applies a single value to one element according to its wording mode. Every
   * Webflow write goes through safeCall (logged + timeout-protected) so a single
   * stuck element can never freeze the deployment. Returns a structured result
   * the caller turns into report stats.
   */
  private async writeElement(
    element: AnyElement,
    mode: string,
    key: string,
    newValue: string,
  ): Promise<ChangeWriteResult> {
    const selector = `[data-wording-key="${key}"]`;
    const el = element as unknown as WritableElement;
    const elementType = el.type ?? "unknown";
    const ctx = `key="${key}" mode="${mode || DEFAULTS.WORDING_MODE}" type="${elementType}"`;

    const success = (): ChangeWriteResult => ({
      status: "success",
      change: {
        key,
        old_value: "",
        new_value: newValue,
        element_selector: selector,
        status: "success",
      },
    });
    const failure = (message: string): ChangeWriteResult => ({
      status: "error",
      change: {
        key,
        old_value: "",
        new_value: newValue,
        element_selector: selector,
        status: "error",
        message,
      },
    });

    // LINK — auto-detect email / phone / external URL / relative path / page
    if (mode === WORDING_MODES.LINK) {
      if (typeof el.setSettings !== "function") {
        return failure(
          `L'élément "${key}" ne supporte pas les liens (pas de méthode setSettings)`,
        );
      }
      try {
        if (EMAIL_REGEX.test(newValue)) {
          await this.safeCall(`setSettings.email (${ctx})`, () =>
            el.setSettings!("email", newValue),
          );
        } else if (PHONE_REGEX.test(newValue)) {
          // Strip a tel: prefix and any spaces/dots/parens/dashes so the href
          // is a clean tel: number (e.g. "+33 6 12 34 56 78" → "+33612345678").
          const cleanPhone = newValue
            .replace(/^tel:/i, "")
            .replace(/[\s.()-]/g, "");
          await this.safeCall(`setSettings.phone (${ctx})`, () =>
            el.setSettings!("phone", cleanPhone),
          );
        } else if (EXTERNAL_URL_REGEX.test(newValue)) {
          await this.safeCall(`setSettings.url[newTab] (${ctx})`, () =>
            el.setSettings!("url", newValue, { openInNewTab: true }),
          );
        } else if (newValue.startsWith("/")) {
          await this.safeCall(`setSettings.url[relative] (${ctx})`, () =>
            el.setSettings!("url", newValue),
          );
        } else {
          const targetPage = await this.findPageByName(newValue);
          if (targetPage) {
            await this.safeCall(`setSettings.page (${ctx})`, () =>
              el.setSettings!("page", targetPage),
            );
          } else {
            await this.safeCall(`setSettings.url[fallback] (${ctx})`, () =>
              el.setSettings!("url", newValue),
            );
          }
        }
        return success();
      } catch (err) {
        return failure(
          `Erreur lien pour "${key}": ${err instanceof Error ? err.message : "erreur inconnue"}`,
        );
      }
    }

    // PLACEHOLDER — form inputs. `placeholder` is a RESERVED attribute in
    // Webflow: setAttribute, setCustomAttribute and setSettings all reject it
    // (native form-field editing is on Webflow's roadmap, not yet shipped). We
    // still attempt both setters in case a future runtime allows it, then skip.
    if (mode === WORDING_MODES.PLACEHOLDER) {
      const attempts: Array<{ label: string; run: () => Promise<unknown> }> =
        [];
      if (typeof el.setAttribute === "function") {
        attempts.push({
          label: `setAttribute.placeholder (${ctx})`,
          run: () => el.setAttribute!("placeholder", newValue),
        });
      }
      if (typeof el.setCustomAttribute === "function") {
        attempts.push({
          label: `setCustomAttribute.placeholder (${ctx})`,
          run: () => el.setCustomAttribute!("placeholder", newValue),
        });
      }
      for (const attempt of attempts) {
        try {
          await this.safeCall(attempt.label, attempt.run);
          return success();
        } catch {
          // This method failed or timed out — try the next one.
        }
      }
      return {
        status: "skipped",
        warning: `Placeholder "${key}" — non modifiable via l'API Webflow (attribut réservé). À définir manuellement dans le Designer (réglages du champ).`,
      };
    }

    // PROP — component instance properties cannot be set via the Designer API
    // (there is no setProperties on elements), so this mode is unsupported.
    if (mode.startsWith("prop:")) {
      return {
        status: "skipped",
        warning: `Mode "prop:" pour "${key}" — non supporté par l'API Designer (propriétés de composant)`,
      };
    }

    // ATTR — not implemented yet, skip with a warning
    if (mode.startsWith("attr:")) {
      const attrName = mode.slice("attr:".length);
      return {
        status: "skipped",
        warning: `Mode attribut "${attrName}" pour "${key}" — non encore implémenté`,
      };
    }

    // HTML — Designer API has no innerHTML; fall back to plain text
    if (mode === WORDING_MODES.HTML) {
      if (el.textContent === true || typeof el.setTextContent === "function") {
        try {
          await this.safeCall(`setTextContent[html] (${ctx})`, () =>
            el.setTextContent!(newValue),
          );
          return {
            ...success(),
            warning: `Mode HTML pour "${key}" — appliqué comme texte simple`,
          };
        } catch (err) {
          return failure(
            `Impossible d'appliquer le HTML pour "${key}": ${err instanceof Error ? err.message : "erreur inconnue"}`,
          );
        }
      }
      return {
        status: "skipped",
        warning: `Mode HTML pour "${key}" — élément sans support texte, ignoré`,
      };
    }

    // FORM BUTTON — a submit button's label is its `value` attribute, which
    // Webflow reserves (same limitation as placeholder). We attempt setAttribute
    // for forward compatibility, then skip rather than report a hard error.
    if (elementType === "FormButton") {
      if (typeof el.setAttribute === "function") {
        try {
          await this.safeCall(`setAttribute.value[FormButton] (${ctx})`, () =>
            el.setAttribute!("value", newValue),
          );
          return success();
        } catch {
          // `value` is reserved on the current runtime — fall through to skip.
        }
      }
      return {
        status: "skipped",
        warning: `Libellé du bouton "${key}" — non modifiable via l'API Webflow (attribut "value" réservé). À définir manuellement dans le Designer.`,
      };
    }

    // TEXT (default, and any unrecognized mode) — cascade of fallbacks
    try {
      if (el.textContent === true || typeof el.setTextContent === "function") {
        await this.safeCall(`setTextContent (${ctx})`, () =>
          el.setTextContent!(newValue),
        );
      } else if (typeof el.setText === "function") {
        // Raw String node (type "String") exposes setText, not setTextContent.
        await this.safeCall(`setText (${ctx})`, () => el.setText!(newValue));
      } else if (typeof el.getChildren === "function") {
        // getChildren() is async — must be awaited before reading length.
        const children = await this.safeCall(`getChildren (${ctx})`, () =>
          el.getChildren!(),
        );
        if (children && children.length > 0) {
          const firstChild = children[0];
          if (
            firstChild.textContent === true ||
            typeof firstChild.setTextContent === "function"
          ) {
            await this.safeCall(`setTextContent[child] (${ctx})`, () =>
              firstChild.setTextContent!(newValue),
            );
          } else if (typeof firstChild.setText === "function") {
            // The text lives in a raw String child node.
            await this.safeCall(`setText[child:String] (${ctx})`, () =>
              firstChild.setText!(newValue),
            );
          } else {
            throw new Error(
              `L'enfant de l'élément (type: ${firstChild.type ?? "unknown"}) ne supporte pas le texte non plus.`,
            );
          }
        } else {
          throw new Error(
            `L'élément est un Block vide (pas d'enfants sur lesquels écrire).`,
          );
        }
      } else {
        throw new Error(
          `Pas de méthode compatible pour le texte (type: ${elementType})`,
        );
      }
      return success();
    } catch (err) {
      return failure(
        `Impossible de définir le texte pour "${key}": ${err instanceof Error ? err.message : "erreur inconnue"}`,
      );
    }
  }

  /**
   * Resolves the target pages (those referenced by the loaded keys, or all
   * pages if no key is dot-prefixed) with their display names. Shared by scan
   * and deploy; every Designer API call is timeout-protected.
   */
  private async resolveTargetPages(): Promise<
    Array<{ page: Page; name: string }>
  > {
    const targetPages = this.extractTargetPagesFromKeys();
    const hasTargetPages = targetPages.size > 0;
    const targets = Array.from(targetPages);

    const pagesAndFolders = await withTimeout(
      webflow.getAllPagesAndFolders(),
      "getAllPagesAndFolders",
      ELEMENT_WRITE_TIMEOUT_MS,
    );
    const allPages = pagesAndFolders?.filter(isPage) ?? [];

    const resolved: Array<{ page: Page; name: string }> = [];
    for (const page of allPages) {
      let name = "";
      try {
        name = await withTimeout(
          page.getName(),
          "page.getName",
          ELEMENT_WRITE_TIMEOUT_MS,
        );
      } catch {
        try {
          name = await withTimeout(
            page.getSlug(),
            "page.getSlug",
            ELEMENT_WRITE_TIMEOUT_MS,
          );
        } catch {
          continue;
        }
      }

      if (
        !hasTargetPages ||
        targets.some((target) => this.isPageMatch(name, target))
      ) {
        resolved.push({ page, name });
      }
    }
    return resolved;
  }

  /**
   * Scanne toutes les pages ciblées pour prévisualiser les changements
   */
  async scanAllPages(
    onProgress?: (status: ScanProgress) => void,
  ): Promise<ScanResult> {
    if (!this.wordingData) {
      throw new Error("Aucune donnée de wording chargée");
    }

    const pagesPreviews: PagePreview[] = [];

    const globalUnusedKeys = new Set(Object.keys(this.wordingData.content));

    // Remove all SEO keys from unused tracking (they are not elements)
    const allSeoKeys = this.getAllSeoKeys();
    for (const seoKey of allSeoKeys) {
      globalUnusedKeys.delete(seoKey);
    }

    try {
      const resolvedPages = await this.resolveTargetPages();
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
          await withTimeout(
            webflow.switchPage(page),
            "switchPage",
            ELEMENT_WRITE_TIMEOUT_MS,
          );

          // Attendre que le Designer charge la page
          await new Promise((resolve) =>
            setTimeout(resolve, PAGE_LOAD_DELAY_MS),
          );

          // Scanner la page
          const preview = await this.previewChanges();

          // Retirer les clés trouvées de la liste des clés non utilisées
          preview.changes.forEach((change) => {
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
              withValue: preview.changes.filter((c) => c.hasValue).length,
              missing: preview.missingKeys.length,
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
          currentPage: "Terminé",
          completed: resolvedPages.length,
          total: resolvedPages.length,
          allPages: allPageNames,
        });
      }

      // Calculer les statistiques globales
      const totalElements = pagesPreviews.reduce(
        (sum, p) => sum + p.stats.total,
        0,
      );
      const totalWithValue = pagesPreviews.reduce(
        (sum, p) => sum + p.stats.withValue,
        0,
      );
      const totalMissing = pagesPreviews.reduce(
        (sum, p) => sum + p.stats.missing,
        0,
      );

      return {
        pagesPreviews,
        summary: {
          totalPages: pagesPreviews.length,
          totalElements,
          totalWithValue,
          totalMissing,
          unusedKeys: Array.from(globalUnusedKeys),
        },
      };
    } catch (error) {
      throw new Error(
        `Erreur lors du scan multi-pages: ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
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
      if (key.includes(".")) {
        const pageName = key.split(".")[0].toLowerCase();
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
    const withoutSpaces = normalized.replace(/[\s-_]/g, "");
    const targetWithoutSpaces = target.replace(/[\s-_]/g, "");
    if (withoutSpaces === targetWithoutSpaces) return true;

    return false;
  }

  /**
   * Déploie le wording sur toutes les pages du site (ou seulement celles ciblées)
   */
  async deployToAllPages(
    onProgress?: (status: ScanProgress) => void,
  ): Promise<DeploymentReport> {
    if (!this.wordingData) {
      throw new Error("Aucune donnée de wording chargée");
    }

    const reports: DeploymentReport[] = [];
    const allSeoChanges: SeoChange[] = [];
    let totalApplied = 0;
    let totalFailed = 0;
    let totalMissing = 0;
    let totalSkipped = 0;

    try {
      const resolvedPages = await this.resolveTargetPages();
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
          await withTimeout(
            webflow.switchPage(page),
            "switchPage",
            ELEMENT_WRITE_TIMEOUT_MS,
          );

          // Attendre un peu que le Designer charge la page
          await new Promise((resolve) =>
            setTimeout(resolve, PAGE_LOAD_DELAY_MS),
          );

          // Appliquer les changements sur cette page
          const report = await this.applyChanges((key) => {
            onProgress?.({
              currentPage: pageName,
              completed: i,
              total: resolvedPages.length,
              currentKey: key,
              allPages: allPageNames,
            });
          });
          report.page_name = pageName;

          // Apply SEO metadata for this page
          const seoEntries = this.extractSeoKeysForPage(pageName);
          if (seoEntries.length > 0) {
            const seoResults = await this.applySeoToPage(
              page,
              seoEntries,
              pageName,
            );
            allSeoChanges.push(...seoResults);
            report.seoChanges = seoResults;
          }

          reports.push(report);

          // Compter les stats
          totalApplied += report.stats.applied;
          totalFailed += report.stats.failed;
          totalMissing += report.stats.missing;
          totalSkipped += report.stats.skipped;
        } catch (error) {
          console.error(`Erreur sur la page ${pageName}:`, error);
          // Continuer avec les autres pages même si une échoue
        }
      }

      // Notifier la fin
      if (onProgress) {
        onProgress({
          currentPage: "Terminé",
          completed: resolvedPages.length,
          total: resolvedPages.length,
          allPages: allPageNames,
        });
      }

      return {
        deployment_id: `multi-${Date.now()}`,
        site_id: this.wordingData.site_id,
        timestamp: new Date().toISOString(),
        page_name: `${resolvedPages.length} pages`,
        changes: [],
        warnings: [],
        errors: [],
        stats: {
          total_keys: totalApplied + totalFailed + totalMissing + totalSkipped,
          applied: totalApplied,
          failed: totalFailed,
          missing: totalMissing,
          skipped: totalSkipped,
        },
        multiPageReports: reports,
        seoChanges: allSeoChanges.length > 0 ? allSeoChanges : undefined,
      };
    } catch (error) {
      throw new Error(
        `Erreur lors du déploiement multi-pages: ${error instanceof Error ? error.message : "erreur inconnue"}`,
      );
    }
  }

  /**
   * Extracts SEO keys from content for a given page name.
   * Keys follow the convention: pageName._seo.field (e.g. home._seo.title)
   * @returns Array of { field, value } entries for this page
   */
  private extractSeoKeysForPage(
    pageName: string,
  ): Array<{ field: string; value: string }> {
    if (!this.wordingData) return [];

    const entries: Array<{ field: string; value: string }> = [];

    for (const [key, value] of Object.entries(this.wordingData.content)) {
      const parts = key.split(".");
      // Expected format: pageName._seo.fieldName
      const seoIdx = parts.indexOf(SEO_SEGMENT);
      if (seoIdx === -1) continue;

      // Page prefix is everything before _seo
      const pagePrefix = parts.slice(0, seoIdx).join(".").toLowerCase();
      if (!this.isPageMatch(pageName, pagePrefix)) continue;

      // Field name is everything after _seo. An empty value is kept on purpose:
      // it lets a CSV/JSON entry clear a page title/description (consistent with
      // the text path).
      const field = parts.slice(seoIdx + 1).join(".");
      if (field) {
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
      if (isSeoKey(key)) {
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
    pageName: string,
  ): Promise<SeoChange[]> {
    const results: SeoChange[] = [];

    for (const entry of seoEntries) {
      const methodName = SEO_FIELDS[entry.field as keyof typeof SEO_FIELDS];
      if (!methodName) {
        results.push({
          pageName,
          field: entry.field,
          value: entry.value,
          status: "error",
          message: `Champ SEO "${entry.field}" non supporté`,
        });
        continue;
      }

      try {
        const pageObj = page as unknown as Record<string, unknown>;
        if (methodName in page && typeof pageObj[methodName] === "function") {
          await (pageObj[methodName] as (val: string) => Promise<void>)(
            entry.value,
          );
          results.push({
            pageName,
            field: entry.field,
            value: entry.value,
            status: "success",
          });
        } else {
          results.push({
            pageName,
            field: entry.field,
            value: entry.value,
            status: "error",
            message: `La méthode ${methodName} n'est pas disponible sur cette page`,
          });
        }
      } catch (err) {
        results.push({
          pageName,
          field: entry.field,
          value: entry.value,
          status: "error",
          message: err instanceof Error ? err.message : "Erreur inconnue",
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
