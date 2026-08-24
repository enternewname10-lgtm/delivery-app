import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LatLng } from '../utils/geocoding';

type StopStatus = 'pending' | 'active' | 'delivered';

export interface RouteMapProps {
  stops: Array<{ coord: LatLng; label: string; status: StopStatus }>;
  startCoord?: LatLng | null;
}

function markerIcon(n: number | '✓', status: StopStatus) {
  const bg = status === 'delivered' ? '#16A34A' : status === 'active' ? '#2563EB' : '#94A3B8';
  return L.divIcon({
    html: `<div style="background:${bg};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${n}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

const startIcon = L.divIcon({
  html: `<div style="background:#0F172A;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25)">YOU</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function BoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    else if (points.length === 1) map.setView(points[0], 14);
  }, [points, map]);
  return null;
}

export default function RouteMap({ stops, startCoord }: RouteMapProps) {
  useEffect(() => {
    if (document.querySelector('link[data-leaflet-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.setAttribute('data-leaflet-css', '1');
    document.head.appendChild(link);
  }, []);

  if (stops.length === 0) return null;

  const allPoints: [number, number][] = [
    ...(startCoord ? [[startCoord.lat, startCoord.lng] as [number, number]] : []),
    ...stops.map(s => [s.coord.lat, s.coord.lng] as [number, number]),
  ];

  const center: [number, number] = startCoord
    ? [startCoord.lat, startCoord.lng]
    : [stops[0].coord.lat, stops[0].coord.lng];

  return (
    <MapContainer center={center} zoom={12} style={{ height: 220, width: '100%', borderRadius: 16 }} zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      <BoundsFitter points={allPoints} />
      {startCoord && (
        <Marker position={[startCoord.lat, startCoord.lng]} icon={startIcon}>
          <Popup>Your location</Popup>
        </Marker>
      )}
      {stops.map((stop, i) => (
        <Marker
          key={i}
          position={[stop.coord.lat, stop.coord.lng]}
          icon={markerIcon(stop.status === 'delivered' ? '✓' : i + 1, stop.status)}
        >
          <Popup><b>{i + 1}.</b> {stop.label}</Popup>
        </Marker>
      ))}
      {allPoints.length > 1 && (
        <Polyline positions={allPoints} color="#2563EB" weight={3} opacity={0.7} dashArray="6 4" />
      )}
    </MapContainer>
  );
}
