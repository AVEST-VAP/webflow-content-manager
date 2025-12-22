/**
 * Constants for the Webflow Content Manager extension
 */

// Delay to wait for Webflow Designer to load a page after switching
export const PAGE_LOAD_DELAY_MS = 500;

// Maximum keys to display in warning messages before truncating
export const MAX_DISPLAYED_WARNINGS = 10;

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

// Default values
export const DEFAULTS = {
  VERSION: '1.0.0',
  WORDING_MODE: WORDING_MODES.TEXT,
} as const;
