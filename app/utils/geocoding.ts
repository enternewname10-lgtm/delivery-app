export interface LatLng {
  lat: number;
  lng: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function simplifyAddress(address: string): string {
  // Strip postal code and try again — Nominatim handles city+province better than full addresses
  return address
    .replace(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g, '')  // Canadian postal
    .replace(/\b\d{5}(-\d{4})?\b/g, '')              // US zip
    .replace(/,\s*,/g, ',')
    .trim()
    .replace(/,\s*$/, '');
}

async function queryNominatim(query: string): Promise<LatLng | null> {
  await sleep(1100);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'DeliveryRouteApp/1.0' } });
    const data = await res.json();
    if (data.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (_) {}
  return null;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  // First try the full address
  const result = await queryNominatim(address);
  if (result) return result;

  // Retry without postal code — Nominatim sometimes chokes on OCR'd postal codes
  const simplified = simplifyAddress(address);
  if (simplified && simplified !== address) {
    return queryNominatim(simplified);
  }

  return null;
}
