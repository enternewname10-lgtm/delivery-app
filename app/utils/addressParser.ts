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

const STREET_TYPES =
  'Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|' +
  'Court|Crt|Ct|Place|Pl|Parkway|Pkwy|Crescent|Cres|Terrace|Ter|' +
  'Trail|Trl|Circle|Cir|Close|Heights|Hts|Point|Pt|Gate|Gardens|Gdns|' +
  'Grove|Grv|Highway|Hwy|Pathway|Path|Square|Sq|Mews|Row';

function fixOCRErrors(text: string): string {
  let t = text;
  // Fix postal codes: O→0, I/l→1, G→6 in numeric positions
  t = t.replace(
    /\b([A-Z])([0-9OI])([A-Z])\s?([0-9OI])([A-Z])([0-9OGI])\b/g,
    (_, a, b, c, d, e, f) => {
      const fix = (ch: string) => ch
        .replace(/O/g, '0').replace(/G/g, '6').replace(/I/g, '1')
        .replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
      return `${a}${fix(b)}${c} ${fix(d)}${e}${fix(f)}`;
    }
  );
  // Fix street numbers where O or I is misread at the start: "O23 Main" → "023 Main"
  t = t.replace(/\b([OIl])(\d{1,4})\b(?=\s+[A-Za-z])/g, (_, first, rest) =>
    (first === 'O' ? '0' : '1') + rest
  );
  return t;
}

// Remove lines that are clearly not address content
function prefilter(lines: string[]): string[] {
  return lines.filter(l => {
    if (l.length < 3) return false;
    if (/^\$[\d,]+/.test(l)) return false;
    if (/^(total|subtotal|tax|hst|gst|pst|qty|quantity|item|amount|price|discount|ref|order#?|invoice|receipt|payment|change|cash|card|visa|mastercard)\b/i.test(l)) return false;
    if (/^\d+$/.test(l)) return false;
    if (/^[\d\s\-\(\)\.+]{8,}$/.test(l)) return false; // phone numbers
    if (/@/.test(l)) return false;
    if (/https?:|www\./i.test(l)) return false;
    if (/^(thank you|thanks|visit us|store hours|open|serving|tel:|fax:|phone:|barcode)/i.test(l)) return false;
    return true;
  });
}

// Find line index after a "Ship To" / "Deliver To" label
function findDeliveryMarker(lines: string[]): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (/^(ship[\s-]?to|deliver[\s-]?to|shipping\s*(address)?|delivery\s*(address)?|send[\s-]?to|recipient)\s*:?\s*$/i.test(lines[i])) {
      return i + 1;
    }
  }
  return null;
}

function build(street: string, city: string, state: string, zip: string): ParsedAddress {
  return { street, city, state, zip, full: `${street}, ${city}, ${state}${zip ? ' ' + zip : ''}` };
}

function isDupe(results: ParsedAddress[], addr: ParsedAddress): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return results.some(r => norm(r.street) === norm(addr.street) && norm(r.city) === norm(addr.city));
}

function tryMatchCity(street: string, candidate: string, prev: string): ParsedAddress | null {
  // "City, Province A1B 2C3" or "City, State 12345"
  const m1 = candidate.match(/^([\w][\w\s.'-]+?)[\s,]+([A-Z]{2})[\s,]+([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)[\s,]*$/);
  if (m1 && STATE_ABBRS.has(m1[2])) return build(street, m1[1].trim(), m1[2], m1[3].trim());

  // Province/State + postal anywhere on line
  const m2 = candidate.match(/\b([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/);
  if (m2 && STATE_ABBRS.has(m2[1])) {
    const city = candidate.split(m2[1])[0].replace(/[,]+$/, '').replace(/[^a-zA-Z\s'-]/g, '').trim() || prev;
    return build(street, city, m2[1], m2[2].trim());
  }

  // "City, Province" no postal
  const m3 = candidate.match(/^([\w][\w\s.'-]*),\s*([A-Z]{2})\s*$/);
  if (m3 && STATE_ABBRS.has(m3[2])) return build(street, m3[1].trim(), m3[2], '');

  return null;
}

export function parseAddresses(rawText: string): ParsedAddress[] {
  if (!rawText) return [];

  const text = fixOCRErrors(rawText);
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').map(l => l.trim()).filter(Boolean);

  const lines = prefilter(rawLines);
  const results: ParsedAddress[] = [];
  const used = new Set<number>();

  const fullLineRe = new RegExp(
    `(\\d+[\\w\\s]*?(?:${STREET_TYPES})\\.?)\\s+([\\w][\\w\\s'-]+?),\\s*([A-Z]{2})\\s+([A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d|\\d{5}(?:-\\d{4})?)`,
    'i'
  );

  // Priority: parse lines immediately after "Ship To" / "Deliver To" markers
  const markerIdx = findDeliveryMarker(lines);
  if (markerIdx !== null && markerIdx < lines.length) {
    const section = lines.slice(markerIdx, markerIdx + 6);
    for (let i = 0; i < section.length; i++) {
      const isStreet = /^\d+\s+\w/.test(section[i]);
      if (!isStreet) continue;
      for (let j = i + 1; j < Math.min(i + 4, section.length); j++) {
        const addr = tryMatchCity(section[i], section[j], section[j - 1] ?? '');
        if (addr && !isDupe(results, addr)) { results.push(addr); break; }
      }
    }
  }

  // Single-line: "123 Main St, City, ON A1B 2C3"
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(fullLineRe);
    if (m && STATE_ABBRS.has(m[3].toUpperCase())) {
      const addr = build(m[1].trim(), m[2].trim(), m[3].toUpperCase(), m[4].trim());
      if (!isDupe(results, addr)) { results.push(addr); used.add(i); }
    }
  }

  // "123 Main St, City, Province" one line, postal code nearby
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const m = lines[i].match(/^(\d+\s+[\w\s,\.]+?),\s*([\w\s'-]+?),\s*([A-Z]{2})\s*[,.]?\s*$/);
    if (!m || !STATE_ABBRS.has(m[3])) continue;

    let zip = '';
    for (let k = i + 1; k <= Math.min(i + 4, lines.length - 1); k++) {
      const pm = lines[k].match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\b/);
      if (pm) { zip = pm[1]; break; }
    }
    const addr = build(m[1].trim(), m[2].trim(), m[3], zip);
    if (!isDupe(results, addr)) { results.push(addr); used.add(i); }
  }

  // Multi-line: street line → city/province line (up to 4 lines below)
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const line = lines[i];
    const isStreet = /^\d+\s+\w/.test(line) || /^(Unit|Apt|Suite|#)\s*[\d-]+/i.test(line);
    if (!isStreet) continue;

    // Handle unit on its own line: combine with next street line
    let street = line;
    let startJ = i + 1;
    if (/^(Unit|Apt|Suite|#)\s*[\d-]+\s*[,-]?\s*$/i.test(line) && i + 1 < lines.length) {
      if (/^\d+\s+\w/.test(lines[i + 1])) {
        street = `${line.replace(/[,\s-]+$/, '')} - ${lines[i + 1]}`;
        startJ = i + 2;
        used.add(i + 1);
      }
    }

    for (let j = startJ; j <= Math.min(i + 4, lines.length - 1); j++) {
      if (used.has(j)) continue;
      const addr = tryMatchCity(street, lines[j], lines[j - 1] ?? '');
      if (addr && !isDupe(results, addr)) {
        results.push(addr);
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  return results;
}

export function parseAddress(rawText: string): ParsedAddress | null {
  return parseAddresses(rawText)[0] ?? null;
}
