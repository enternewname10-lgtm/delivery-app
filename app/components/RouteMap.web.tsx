import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LatLng } from '../utils/geocoding';

function createNumberedIcon(n: number) {
  return L.divIcon({
    html: `<div style="background:#2563EB;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${n}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

const startIcon = L.divIcon({
  html: `<div style="background:#16A34A;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)">YOU</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function BoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export interface RouteMapProps {
  stops: LatLng[];
  stopLabels: string[];
  startCoord?: LatLng | null;
}

export default function RouteMap({ stops, stopLabels, startCoord }: RouteMapProps) {
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
    ...stops.map((s) => [s.lat, s.lng] as [number, number]),
  ];

  const polylinePoints: [number, number][] = allPoints;

  return (
    <MapContainer
      center={[stops[0].lat, stops[0].lng]}
      zoom={12}
      style={{ height: 320, width: '100%', borderRadius: 14 }}
      zoomControl
    >
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
        <Marker key={i} position={[stop.lat, stop.lng]} icon={createNumberedIcon(i + 1)}>
          <Popup>{stopLabels[i] || `Stop ${i + 1}`}</Popup>
        </Marker>
      ))}

      {polylinePoints.length > 1 && (
        <Polyline positions={polylinePoints} color="#2563EB" weight={4} opacity={0.8} />
      )}
    </MapContainer>
  );
}
