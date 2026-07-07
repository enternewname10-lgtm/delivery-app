export interface ParsedAddress {
  name?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
}

const STREET_TYPES =
  'St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway|Cir|Circle|Ter|Terrace|Trl|Trail';

export function parseAddress(text: string): ParsedAddress | null {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Try full inline pattern: "123 Main St, City, ST 12345"
  const inlinePattern = new RegExp(
    `(\\d+\\s+[\\w\\s]+(?:${STREET_TYPES})\\.?(?:\\s+(?:Apt|Suite|Ste|Unit|#)\\s*[\\w-]+)?),?\\s*([\\w\\s]+),\\s*([A-Z]{2})\\s+(\\d{5}(?:-\\d{4})?)`,
    'i'
  );
  const inlineMatch = inlinePattern.exec(normalized);
  if (inlineMatch) {
    return {
      street: inlineMatch[1].trim(),
      city: inlineMatch[2].trim(),
      state: inlineMatch[3].toUpperCase(),
      zip: inlineMatch[4].trim(),
      full: inlineMatch[0].trim(),
    };
  }

  // Fallback: scan line-by-line for street on one line, "City, ST ZIP" on the next
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d+\s+\w/.test(lines[i])) {
      const cityLine = /^(.+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(lines[i + 1]);
      if (cityLine) {
        return {
          street: lines[i],
          city: cityLine[1].trim(),
          state: cityLine[2].toUpperCase(),
          zip: cityLine[3],
          full: `${lines[i]}, ${lines[i + 1]}`,
        };
      }
    }
  }

  return null;
}
