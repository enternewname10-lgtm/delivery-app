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
]);

export function parseAddress(text: string): ParsedAddress | null {
  if (!text) return null;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  // Find every line that looks like a street (starts with a number)
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d+\s+\w/.test(lines[i])) continue;

    const street = lines[i];

    // Search the next 3 lines for city/state/zip
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const candidate = lines[j];

      // Pattern: "City, ST 12345" or "City ST 12345"
      const m = candidate.match(/^([\w\s]+?)[\s,]+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (m && STATE_ABBRS.has(m[2])) {
        return {
          street,
          city: m[1].trim(),
          state: m[2],
          zip: m[3],
          full: `${street}, ${m[1].trim()}, ${m[2]} ${m[3]}`,
        };
      }

      // Pattern: zip code alone on a line, state on same or previous line
      const zipOnly = candidate.match(/\b(\d{5}(?:-\d{4})?)\b/);
      if (zipOnly) {
        // Look for state abbreviation in this line or the previous
        const stateMatch = candidate.match(/\b([A-Z]{2})\b/) || lines[j - 1]?.match(/\b([A-Z]{2})\b/);
        if (stateMatch && STATE_ABBRS.has(stateMatch[1])) {
          // Try to get city from previous line
          const city = lines[j - 1]?.replace(/[^a-zA-Z\s]/g, '').trim() || '';
          return {
            street,
            city,
            state: stateMatch[1],
            zip: zipOnly[1],
            full: `${street}, ${city}, ${stateMatch[1]} ${zipOnly[1]}`,
          };
        }
      }
    }
  }

  // Last resort: find any zip code and work backwards
  for (let i = 0; i < lines.length; i++) {
    const zipMatch = lines[i].match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (!zipMatch) continue;

    const stateMatch = lines[i].match(/\b([A-Z]{2})\b/);
    if (!stateMatch || !STATE_ABBRS.has(stateMatch[1])) continue;

    // Walk backwards to find the street number
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      if (/^\d+\s+\w/.test(lines[j])) {
        const city = lines[i].split(stateMatch[1])[0].replace(/[^a-zA-Z\s]/g, '').trim();
        return {
          street: lines[j],
          city,
          state: stateMatch[1],
          zip: zipMatch[1],
          full: `${lines[j]}, ${city}, ${stateMatch[1]} ${zipMatch[1]}`,
        };
      }
    }
  }

  return null;
}
