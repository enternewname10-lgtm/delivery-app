import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LatLng {
  lat: number;
  lng: number;
}

// In-memory cache for the current session (instant)
const MEM = new Map<string, LatLng | null>();
const PREFIX = 'geo:v1:';

function cacheKey(addr: string) {
  return addr.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function loadCache(k: string): Promise<{ hit: true; val: LatLng | null } | { hit: false }> {
  if (MEM.has(k)) return { hit: true, val: MEM.get(k) ?? null };
  try {
    const raw = await AsyncStorage.getItem(PREFIX + k);
    if (raw === null) return { hit: false };
    const val = raw === 'null' ? null : (JSON.parse(raw) as LatLng);
    MEM.set(k, val);
    return { hit: true, val };
  } catch {
    return { hit: false };
  }
}

async function saveCache(k: string, val: LatLng | null) {
  MEM.set(k, val);
  try {
    await AsyncStorage.setItem(PREFIX + k, val === null ? 'null' : JSON.stringify(val));
  } catch {}
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function simplifyAddress(address: string): string {
  return address
    .replace(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g, '')
    .replace(/\b\d{5}(-\d{4})?\b/g, '')
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
  } catch {}
  return null;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const k = cacheKey(address);

  // Check cache first — if hit, return immediately (no Nominatim wait)
  const cached = await loadCache(k);
  if (cached.hit) return cached.val;

  // Cache miss — geocode and store result
  let result = await queryNominatim(address);

  if (!result) {
    const simplified = simplifyAddress(address);
    if (simplified && simplified !== address) {
      const k2 = cacheKey(simplified);
      const cached2 = await loadCache(k2);
      if (cached2.hit) {
        result = cached2.val;
      } else {
        result = await queryNominatim(simplified);
        await saveCache(k2, result);
      }
    }
  }

  await saveCache(k, result);
  return result;
}
