// Minimal CSV reading and writing (RFC 4180 quoting) for bank statements and our own export.

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

/** Guesses the delimiter from the first lines, ignoring characters inside quotes. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 12);
  let best = ',';
  let bestScore = 0;
  for (const d of CANDIDATE_DELIMITERS) {
    let score = 0;
    for (const line of lines) {
      let inQuotes = false;
      let n = 0;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === d && !inQuotes) n++;
      }
      score += n;
    }
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** Parses CSV text into rows of trimmed cells. Blank rows are dropped. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else if (ch === '\n') {
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Text cells beginning with = + - @ (or a control character) are executed as formulas by Excel and
 * Sheets. Prefixing a quote makes them plain text, so a merchant called "=HYPERLINK(...)" is harmless.
 */
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const needsQuoting = (s: string) => /[",\r\n]/.test(s);

/** Serializes rows to CSV (CRLF line endings, quoted only where needed). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((v) => {
          const s = v === null || v === undefined ? '' : String(v);
          return needsQuoting(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\r\n');
}
