/**
 * Constants for the Webflow Content Manager extension
 */

// Delay to wait for Webflow Designer to load a page after switching
export const PAGE_LOAD_DELAY_MS = 500;

// Timeout for a single Webflow Designer API call during scan/deploy.
// Converts a hanging call into a catchable error so one stuck element
// cannot freeze the whole deployment.
export const ELEMENT_WRITE_TIMEOUT_MS = 8000;

// Maximum keys to display in warning messages before truncating
export const MAX_DISPLAYED_WARNINGS = 10;

// Maximum duplicate keys to display in the warning card
export const MAX_DISPLAYED_DUPLICATE_KEYS = 5;

// Fixed wording modes understood at runtime (the data-wording-mode attribute).
// "attr:<name>" and "prop:<name>" are dynamic-prefix modes handled separately.
export const WORDING_MODES = {
  TEXT: "text",
  LINK: "link",
  PLACEHOLDER: "placeholder",
  HTML: "html",
} as const;

// Custom attribute names used for content targeting
export const ATTRIBUTES = {
  WORDING_KEY: "data-wording-key",
  WORDING_MODE: "data-wording-mode",
} as const;

// Form-field element types whose visible text / placeholder / label Webflow's
// Designer API cannot set (reserved attributes — native form-field editing is on
// Webflow's roadmap). The pre-flight audit flags tagged elements of these types
// so their values are set manually in the Designer.
export const UNSUPPORTED_FORM_FIELD_TYPES: ReadonlySet<string> = new Set([
  "FormTextInput",
  "FormTextarea",
  "FormSelect",
  "FormButton",
  "SearchInput",
  "UserFormTextInput",
  "UserFormEmailInput",
  "UserFormNameInput",
  "UserFormPasswordInput",
  "UserFormNumberInput",
]);

// Max edit distance for the audit to flag two keys as a likely typo.
export const MAX_TYPO_DISTANCE = 2;

// Link mode auto-detection patterns
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^(?:tel:)?(?:\+|00)?[\d\s.\-()]{7,}$/;
export const EXTERNAL_URL_REGEX = /^https?:\/\//i;

// Preview section grouping
export const FALLBACK_SECTION_NAME = "Général";
export const MAX_PREVIEW_VALUE_LENGTH = 80;

// Display name for the current page in single-page mode (the Designer API does
// not expose the active page name cheaply here).
export const SINGLE_PAGE_NAME = "Page courante";

// SEO: the exact key segment that marks a metadata key (e.g. home._seo.title)
// and the supported fields mapped to their Page API method.
export const SEO_SEGMENT = "_seo";
export const SEO_FIELDS = {
  title: "setTitle",
  description: "setDescription",
} as const;

// Default values
export const DEFAULTS = {
  VERSION: "1.0.0",
  WORDING_MODE: WORDING_MODES.TEXT,
} as const;
