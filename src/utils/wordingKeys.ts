import { SEO_SEGMENT } from "./constants";

/**
 * True when a content key targets page SEO metadata (e.g. "home._seo.title"),
 * identified by an exact "_seo" path segment (not a substring). Shared by the
 * deployer and the pre-flight audit so the rule lives in a single place.
 */
export const isSeoKey = (key: string): boolean =>
  key.split(".").includes(SEO_SEGMENT);
