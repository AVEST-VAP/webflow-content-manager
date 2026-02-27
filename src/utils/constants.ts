/**
 * Constants for the Webflow Content Manager extension
 */

// Delay to wait for Webflow Designer to load a page after switching
export const PAGE_LOAD_DELAY_MS = 500;

// Maximum keys to display in warning messages before truncating
export const MAX_DISPLAYED_WARNINGS = 10;

// Maximum duplicate keys to display in the warning card
export const MAX_DISPLAYED_DUPLICATE_KEYS = 5;

// Supported wording modes for content replacement
export const WORDING_MODES = {
  TEXT: 'text',
  HTML: 'html',
  ATTR_HREF: 'attr:href',
  ATTR_SRC: 'attr:src',
  ATTR_ALT: 'attr:alt',
} as const;

// Custom attribute names used for content targeting
export const ATTRIBUTES = {
  WORDING_KEY: 'data-wording-key',
  WORDING_MODE: 'data-wording-mode',
} as const;

// Link mode auto-detection patterns
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^(?:tel:)?(?:\+|00)?[\d\s.\-()]{7,}$/;
export const EXTERNAL_URL_REGEX = /^https?:\/\//i;

// Preview section grouping
export const FALLBACK_SECTION_NAME = 'Général';
export const MAX_PREVIEW_VALUE_LENGTH = 80;

// SEO metadata key prefix and supported fields
export const SEO_KEY_PREFIX = '_seo.';
export const SEO_FIELDS: Record<string, string> = {
  'title': 'setTitle',
  'description': 'setDescription',
} as const;

// Default values
export const DEFAULTS = {
  VERSION: '1.0.0',
  WORDING_MODE: WORDING_MODES.TEXT,
} as const;
