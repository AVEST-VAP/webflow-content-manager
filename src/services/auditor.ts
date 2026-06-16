import {
  WordingContent,
  Change,
  ScannedElement,
  AuditReport,
  AuditTypo,
  AuditOrphan,
} from "../types";
import { isSeoKey } from "../utils/wordingKeys";
import { levenshtein } from "../utils/levenshtein";
import {
  UNSUPPORTED_FORM_FIELD_TYPES,
  MAX_TYPO_DISTANCE,
  SINGLE_PAGE_NAME,
} from "../utils/constants";

/** Minimal shape the audit needs from a scan preview (single- or multi-page). */
interface PreviewLike {
  single?: boolean;
  changes?: Change[];
  pagesPreviews?: Array<{ pageName: string; changes: Change[] }>;
}

/** Keeps the first occurrence of each key (stable). */
const dedupeByKey = <T extends { key: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

/**
 * Flattens a scan preview into a page-qualified list of tagged elements. Pure.
 * Typed structurally (PreviewLike) so this service never depends on the UI/hook
 * layer.
 */
export const collectScannedElements = (
  preview: PreviewLike,
): ScannedElement[] => {
  const toScanned = (change: Change, pageName: string): ScannedElement => ({
    key: change.key,
    pageName,
    type: change.type ?? "unknown",
    mode: change.mode ?? "text",
    hasValue: change.hasValue,
  });

  if (preview.single) {
    return (preview.changes ?? []).map((c) => toScanned(c, SINGLE_PAGE_NAME));
  }
  return (preview.pagesPreviews ?? []).flatMap((page) =>
    page.changes.map((c) => toScanned(c, page.pageName)),
  );
};

/**
 * Pre-flight audit: cross-checks the loaded content against the elements found
 * during the scan. Pure — no Webflow API calls. Surfaces tagging gaps, likely
 * typos, and values Webflow's API cannot apply, before deploying.
 */
export const auditContent = (
  content: WordingContent,
  scannedElements: ScannedElement[],
): AuditReport => {
  // Elements tagged with an empty data-wording-key are meaningless — ignore
  // them everywhere in the analysis.
  const elements = scannedElements.filter((e) => e.key.trim() !== "");
  const taggedKeys = new Set(elements.map((e) => e.key));

  // Content keys with no matching element. SEO keys target page metadata (not a
  // DOM element), so they're excluded.
  const rawMissing = Object.keys(content).filter(
    (key) => !isSeoKey(key) && !taggedKeys.has(key),
  );

  // Elements tagged but with no value in the loaded content (deduped by key).
  const rawOrphans: AuditOrphan[] = dedupeByKey(
    elements.filter((e) => !e.hasValue),
  ).map((e) => ({ key: e.key, pageName: e.pageName }));

  // Likely typos: pair each missing content key with the closest orphan tag
  // within a small edit distance. Each orphan can explain at most one typo, and
  // numbered variants (cta1/cta2, subtitle1/2…) are intentional, not typos.
  const typos: AuditTypo[] = [];
  const usedOrphans = new Set<string>();
  const isNumberedVariant = (a: string, b: string): boolean =>
    a.replace(/\d+/g, "#") === b.replace(/\d+/g, "#");

  for (const contentKey of rawMissing) {
    let best: AuditTypo | null = null;
    for (const orphan of rawOrphans) {
      if (usedOrphans.has(orphan.key)) continue;
      if (isNumberedVariant(contentKey, orphan.key)) continue;
      const distance = levenshtein(contentKey, orphan.key);
      if (distance === 0 || distance > MAX_TYPO_DISTANCE) continue;
      if (!best || distance < best.distance) {
        best = {
          contentKey,
          taggedKey: orphan.key,
          pageName: orphan.pageName,
          distance,
        };
      }
    }
    if (best) {
      typos.push(best);
      usedOrphans.add(best.taggedKey);
    }
  }

  // A typo explains both its content key (missing) and its tagged key (orphan),
  // so drop them from those lists to avoid reporting the same issue three times.
  const typoContentKeys = new Set(typos.map((t) => t.contentKey));
  const typoTaggedKeys = new Set(typos.map((t) => t.taggedKey));
  const missingTags = rawMissing.filter((k) => !typoContentKeys.has(k));
  const orphanTags = rawOrphans.filter((o) => !typoTaggedKeys.has(o.key));

  // Values targeting form fields Webflow's API cannot set (placeholder, button
  // label…) that actually have a value to deploy.
  const unsupported = dedupeByKey(
    elements.filter(
      (e) => e.hasValue && UNSUPPORTED_FORM_FIELD_TYPES.has(e.type),
    ),
  ).map((e) => ({ key: e.key, pageName: e.pageName, type: e.type }));

  const hasFindings =
    missingTags.length > 0 ||
    orphanTags.length > 0 ||
    typos.length > 0 ||
    unsupported.length > 0;

  return { missingTags, orphanTags, typos, unsupported, hasFindings };
};
