import { LatLng } from './geocoding';

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function routeDistance(points: LatLng[]): number {
  let d = 0;
  for (let i = 0; i < points.length - 1; i++) d += haversine(points[i], points[i + 1]);
  return d;
}

function nearestNeighbor(start: LatLng, stops: LatLng[]): number[] {
  const order: number[] = [];
  const unvisited = new Set(stops.map((_, i) => i));
  let current = start;
  while (unvisited.size > 0) {
    let best = -1, bestDist = Infinity;
    for (const i of unvisited) {
      const d = haversine(current, stops[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    order.push(best);
    current = stops[best];
    unvisited.delete(best);
  }
  return order;
}

function twoOpt(start: LatLng, stops: LatLng[], order: number[]): number[] {
  let best = [...order];
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const next = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const currentPoints = [start, ...best.map((k) => stops[k])];
        const nextPoints = [start, ...next.map((k) => stops[k])];
        if (routeDistance(nextPoints) < routeDistance(currentPoints)) {
          best = next;
          improved = true;
        }
      }
    }
  }
  return best;
}

export interface RouteResult {
  order: number[];      // indices into the original stops array
  totalKm: number;
  legKm: number[];      // distance from previous point for each stop
}

export function optimizeRoute(start: LatLng, stops: LatLng[]): RouteResult {
  if (stops.length === 0) return { order: [], totalKm: 0, legKm: [] };

  const greedyOrder = nearestNeighbor(start, stops);
  const order = stops.length > 2 ? twoOpt(start, stops, greedyOrder) : greedyOrder;

  const points = [start, ...order.map((i) => stops[i])];
  const legKm = order.map((_, idx) => haversine(points[idx], points[idx + 1]));
  const totalKm = legKm.reduce((a, b) => a + b, 0);

  return { order, totalKm, legKm };
}

export function kmToDisplay(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
