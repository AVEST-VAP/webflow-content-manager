import Papa from "papaparse";

// A parsed CSV row, keyed by its (trimmed) header names.
type CSVRow = Record<string, string | undefined>;

export interface ParsedRow {
  key: string;
  value: string;
}

export interface DuplicateKey {
  key: string;
  occurrences: number;
  values: string[];
}

export interface CSVParseResult {
  rows: ParsedRow[];
  duplicateKeys: DuplicateKey[];
}

// PapaParse options shared by both parsers. `transformHeader` trims column
// names so a stray space in a Google Sheets export ("Key ") still matches.
const PARSE_CONFIG = {
  header: true as const,
  skipEmptyLines: true as const,
  transformHeader: (header: string): string => header.trim(),
};

/**
 * Extracts the key/value pair from a parsed row, tolerant to column casing and
 * stray spaces ("Key"/"key", " Data "). Only the key is required: an empty
 * value is a deliberate "clear this content" instruction (aligned with the JSON
 * path, which also deploys empty strings).
 */
const extractKeyValue = (row: CSVRow): ParsedRow => {
  const normalized: Record<string, string> = {};
  for (const [column, value] of Object.entries(row)) {
    if (value != null) normalized[column.trim().toLowerCase()] = value;
  }
  return {
    key: (normalized["key"] ?? "").trim(),
    value: (normalized["data"] ?? "").trim(),
  };
};

/**
 * Builds the error thrown when no usable row was found, distinguishing
 * "columns missing" from "columns present but no data row".
 */
const buildEmptyError = (fields: string[] | undefined): Error => {
  const normalized = (fields ?? []).map((f) => f.trim().toLowerCase());
  const hasColumns = normalized.includes("key") && normalized.includes("data");
  return hasColumns
    ? new Error(
        'Le CSV contient les colonnes "Key" et "Data" mais aucune ligne de données.',
      )
    : new Error('Le CSV doit contenir les colonnes "Key" et "Data".');
};

/**
 * Parse CSV text and extract Key/Data columns.
 * Tolerant to column casing and surrounding spaces; quoted fields with commas
 * are handled by PapaParse.
 */
export const parseCSV = (csvText: string): Promise<ParsedRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(csvText, {
      ...PARSE_CONFIG,
      complete: (results) => {
        const rows: ParsedRow[] = [];
        for (const row of results.data) {
          const { key, value } = extractKeyValue(row);
          if (key) rows.push({ key, value });
        }

        if (rows.length === 0) {
          reject(buildEmptyError(results.meta.fields));
          return;
        }

        resolve(rows);
      },
      error: (error: Error) => {
        reject(new Error(`Erreur de parsing CSV : ${error.message}`));
      },
    });
  });
};

/**
 * Parse CSV text and detect duplicate keys.
 * Returns rows (last-value-wins, same as parseCSV) plus a list of duplicates.
 */
export const parseCSVWithDuplicates = (
  csvText: string,
): Promise<CSVParseResult> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(csvText, {
      ...PARSE_CONFIG,
      complete: (results) => {
        const rows: ParsedRow[] = [];
        const keyCounts = new Map<string, string[]>();

        for (const row of results.data) {
          const { key, value } = extractKeyValue(row);
          if (!key) continue;

          rows.push({ key, value });

          const existing = keyCounts.get(key);
          if (existing) {
            existing.push(value);
          } else {
            keyCounts.set(key, [value]);
          }
        }

        if (rows.length === 0) {
          reject(buildEmptyError(results.meta.fields));
          return;
        }

        const duplicateKeys: DuplicateKey[] = [];
        for (const [key, values] of keyCounts) {
          if (values.length > 1) {
            duplicateKeys.push({ key, occurrences: values.length, values });
          }
        }

        resolve({ rows, duplicateKeys });
      },
      error: (error: Error) => {
        reject(new Error(`Erreur de parsing CSV : ${error.message}`));
      },
    });
  });
};

/**
 * Convert parsed CSV rows to a content object for WordingData
 */
export const csvRowsToContent = (rows: ParsedRow[]): Record<string, string> => {
  const content: Record<string, string> = {};
  for (const row of rows) {
    content[row.key] = row.value;
  }
  return content;
};
