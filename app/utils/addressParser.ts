export interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
}

const STATE_ABBRS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
  'AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT',
]);

function fixOCRErrors(text: string): string {
  return text.replace(
    /\b([A-Z])([0-9O])([A-Z])\s?([0-9O])([A-Z])([0-9OG])\b/g,
    (_, a, b, c, d, e, f) => {
      const d2 = (ch: string) =>
        ch.replace(/O/g, '0').replace(/G/g, '6').replace(/I/g, '1')
          .replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
      return `${a}${d2(b)}${c} ${d2(d)}${e}${d2(f)}`;
    }
  );
}

function tryMatchCity(street: string, candidate: string, prevLine: string): ParsedAddress | null {
  // "City, Province Postal"
  const m = candidate.match(/^([\w\s.]+?)[\s,]+([A-Z]{2})[\s,]+([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)[\s,]*$/);
  if (m && STATE_ABBRS.has(m[2])) {
    return { street, city: m[1].trim(), state: m[2], zip: m[3].trim(), full: `${street}, ${m[1].trim()}, ${m[2]} ${m[3].trim()}` };
  }

  // Province + postal anywhere on the line
  const stateZip = candidate.match(/\b([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/);
  if (stateZip && STATE_ABBRS.has(stateZip[1])) {
    const city = candidate.split(stateZip[1])[0].replace(/[^a-zA-Z\s]/g, '').trim() || prevLine;
    return { street, city, state: stateZip[1], zip: stateZip[2].trim(), full: `${street}, ${city}, ${stateZip[1]} ${stateZip[2].trim()}` };
  }

  // "City, Province" with no postal
  const cityProv = candidate.match(/^([\w][\w\s.]*),\s*([A-Z]{2})\s*$/);
  if (cityProv && STATE_ABBRS.has(cityProv[2])) {
    return { street, city: cityProv[1].trim(), state: cityProv[2], zip: '', full: `${street}, ${cityProv[1].trim()}, ${cityProv[2]}` };
  }

  return null;
}

// Find ALL addresses in the text — used when one photo has multiple receipts
export function parseAddresses(rawText: string): ParsedAddress[] {
  if (!rawText) return [];

  const text = fixOCRErrors(rawText);
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').map((l) => l.trim()).filter(Boolean);

  const results: ParsedAddress[] = [];
  const used = new Set<number>();

  // Single-line full addresses: "123 Main St City, ON A1B 2C3"
  const STREET_TYPES = 'Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Crt|Ct|Place|Pl|Parkway|Pkwy|Crescent|Cres';
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(
      new RegExp(`(\\d+\\s+[\\w\\s]+?(?:${STREET_TYPES})\\.?)\\s+([\\w][\\w\\s]+?),\\s*([A-Z]{2})\\s+([A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d|\\d{5}(?:-\\d{4})?)`, 'i')
    );
    if (m && STATE_ABBRS.has(m[3].toUpperCase())) {
      results.push({ street: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zip: m[4].trim(), full: `${m[1].trim()}, ${m[2].trim()}, ${m[3].toUpperCase()} ${m[4].trim()}` });
      used.add(i);
    }
  }

  // "123 Main St, City, Province" all on one line — postal code may be 1-3 lines below
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const m = lines[i].match(/^(\d+\s+[\w\s,\.]+?),\s*([\w\s]+?),\s*([A-Z]{2})\s*[,.]?\s*$/);
    if (!m || !STATE_ABBRS.has(m[3])) continue;

    let zip = '';
    for (let k = i + 1; k <= Math.min(i + 4, lines.length - 1); k++) {
      const pm = lines[k].match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/);
      if (pm) { zip = pm[1]; break; }
    }

    const addr: ParsedAddress = {
      street: m[1].trim(),
      city: m[2].trim(),
      state: m[3],
      zip,
      full: `${m[1].trim()}, ${m[2].trim()}, ${m[3]}${zip ? ' ' + zip : ''}`,
    };
    if (!results.some((r) => r.full === addr.full)) {
      results.push(addr);
      used.add(i);
    }
  }

  // Multi-line addresses: street on one line, city/province on next
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;

    const line = lines[i];
    const isStreet = /^\d+\s+\w/.test(line) || /^(Unit|Apt|Suite|#)\s*\d+/i.test(line);
    if (!isStreet) continue;

    for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
      if (used.has(j)) continue;
      const addr = tryMatchCity(line, lines[j], lines[j - 1] ?? '');
      if (addr) {
        if (!results.some((r) => r.full === addr.full)) {
          results.push(addr);
        }
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  return results;
}

// Single-address version (used for one receipt at a time)
export function parseAddress(rawText: string): ParsedAddress | null {
  return parseAddresses(rawText)[0] ?? null;
}
