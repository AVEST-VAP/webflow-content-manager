// Types pour le système de déploiement de wording

export interface WordingContent {
  [key: string]: string;
}

export interface WordingData {
  site_id: string;
  version: string;
  updated_at?: string;
  content: WordingContent;
}

export interface ChangeReport {
  key: string;
  old_value: string;
  new_value: string;
  element_selector: string;
  status: "success" | "error" | "warning";
  message?: string;
}

export interface SeoChange {
  pageName: string;
  field: string;
  value: string;
  status: "success" | "error";
  message?: string;
}

export interface DeploymentReport {
  deployment_id: string;
  site_id: string;
  timestamp: string;
  page_name: string;
  changes: ChangeReport[];
  warnings: string[];
  errors: string[];
  stats: {
    total_keys: number;
    applied: number;
    failed: number;
    missing: number;
    // Items intentionally not applied (e.g. placeholder / submit-button label,
    // which Webflow's API does not allow setting). Not failures.
    skipped: number;
  };
  multiPageReports?: DeploymentReport[];
  seoChanges?: SeoChange[];
}

/**
 * A single content change for one tagged element (used by the scan preview and
 * the deploy report). `type`/`mode` carry the element's Webflow type and
 * data-wording-mode, populated during the scan and consumed by the audit.
 */
export interface Change {
  key: string;
  hasValue: boolean;
  newValue?: string;
  type?: string;
  mode?: string;
}

/** A SEO metadata entry (e.g. { field: "title", value: "…" }). */
export interface SeoEntry {
  field: string;
  value: string;
}

/** Scan preview for a single page. */
export interface PagePreview {
  pageName: string;
  changes: Change[];
  missingKeys: string[];
  stats: {
    total: number;
    withValue: number;
    missing: number;
  };
  seoKeys?: SeoEntry[];
}

/** Aggregate totals across all scanned pages. */
export interface PreviewSummary {
  totalPages: number;
  totalElements: number;
  totalWithValue: number;
  totalMissing: number;
  unusedKeys: string[];
}

/** Preview data shown before deploy (single- or multi-page). */
export interface PreviewData {
  single?: boolean;
  changes?: Change[];
  missingKeys?: string[];
  pagesPreviews?: PagePreview[];
  summary?: PreviewSummary;
}

/** Raw multi-page scan result returned by the deployer. */
export interface ScanResult {
  pagesPreviews: PagePreview[];
  summary: PreviewSummary;
}

/** Changes grouped by section for the preview UI. */
export interface SectionGroup {
  sectionName: string;
  changes: Change[];
}

/** Live progress of a scan/deploy run. */
export interface ScanProgress {
  currentPage: string;
  completed: number;
  total: number;
  mode?: "scan" | "deploy";
  currentKey?: string;
  allPages?: string[];
}

// ── Pre-flight audit ──────────────────────────────────────────────────────

/** A tagged element found during the scan, flattened and page-qualified. */
export interface ScannedElement {
  key: string;
  pageName: string;
  type: string;
  mode: string;
  hasValue: boolean;
}

/** An element tagged on the site but with no value in the loaded content. */
export interface AuditOrphan {
  key: string;
  pageName: string;
}

/** A likely typo: a content key close (small edit distance) to a tagged key. */
export interface AuditTypo {
  contentKey: string;
  taggedKey: string;
  pageName: string;
  distance: number;
}

/** A value that targets a form field Webflow's API cannot set. */
export interface AuditUnsupported {
  key: string;
  pageName: string;
  type: string;
}

/** Result of the pre-flight audit (pure analysis of content vs. scan). */
export interface AuditReport {
  missingTags: string[];
  orphanTags: AuditOrphan[];
  typos: AuditTypo[];
  unsupported: AuditUnsupported[];
  hasFindings: boolean;
}
