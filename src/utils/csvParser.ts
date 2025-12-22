import Papa from 'papaparse';

// CSV row structure from Google Sheets export
interface CSVRow {
  key?: string;
  Key?: string;
  data?: string;
  Data?: string;
  [key: string]: string | undefined;
}

export interface ParsedRow {
  key: string;
  value: string;
}

/**
 * Parse CSV text and extract Key/Data columns
 * Supports both lowercase and capitalized column names
 * Handles quoted fields with commas correctly via PapaParse
 */
export const parseCSV = (csvText: string): Promise<ParsedRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: ParsedRow[] = [];

        for (const row of results.data) {
          // Support both "key"/"Key" and "data"/"Data" column names
          const key = (row.key || row.Key || '').trim();
          const value = (row.data || row.Data || '').trim();

          if (key && value) {
            rows.push({ key, value });
          }
        }

        if (rows.length === 0) {
          reject(new Error('CSV must contain "Key" and "Data" columns with at least one row of data'));
          return;
        }

        resolve(rows);
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
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
