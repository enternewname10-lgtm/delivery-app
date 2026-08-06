import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, SafeAreaView, Linking, Alert, Clipboard,
} from 'react-native';
import * as Location from 'expo-location';
import { ParsedAddress } from '../utils/addressParser';
import { geocodeAddress, LatLng } from '../utils/geocoding';
import { optimizeRoute, RouteResult, kmToDisplay } from '../utils/routing';

interface Props {
  addresses: ParsedAddress[];
  onBack: () => void;
}

type Status = 'locating' | 'geocoding' | 'optimizing' | 'ready' | 'error';

interface OrderedStop {
  address: ParsedAddress;
  coord: LatLng | null;
}

function buildRoutePrompt(stops: OrderedStop[], hasGPS: boolean): string {
  if (stops.length === 0) return '';
  const from = hasGPS ? 'my current location' : stops[0].address.street + ', ' + stops[0].address.city;
  const deliveries = (hasGPS ? stops : stops.slice(1))
    .map((s, i) => {
      const addr = `${s.address.street}, ${s.address.city}, ${s.address.state}${s.address.zip ? ' ' + s.address.zip : ''}`;
      return i === 0 ? `take me to ${addr}` : `then ${addr}`;
    })
    .join(', ');
  return `Starting from ${from}, ${deliveries}.`;
}

export default function RouteView({ addresses, onBack }: Props) {
  const [status, setStatus] = useState<Status>('locating');
  const [statusText, setStatusText] = useState('Getting your location...');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stops, setStops] = useState<OrderedStop[]>([]);
  const [hasGPS, setHasGPS] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { buildRoute(); }, []);

  async function buildRoute() {
    try {
      setStatus('locating');
      setStatusText('Getting your location...');
      let gps: LatLng | null = null;
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      } catch (_) {}
      setHasGPS(!!gps);

      setStatus('geocoding');
      const coords: (LatLng | null)[] = [];
      for (let i = 0; i < addresses.length; i++) {
        setStatusText(`Looking up address ${i + 1} of ${addresses.length}…`);
        coords.push(await geocodeAddress(addresses[i].full));
      }

      setStatus('optimizing');
      setStatusText('Finding the fastest order…');
      await new Promise((r) => setTimeout(r, 50));

      const geocodedIdx = coords.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
      const failedIdx = coords.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
      let ordered: OrderedStop[] = [];

      if (geocodedIdx.length >= 2) {
        const geocodedCoords = geocodedIdx.map((i) => coords[i] as LatLng);
        const start = gps ?? geocodedCoords[0];
        const stopsCoords = gps ? geocodedCoords : geocodedCoords.slice(1);
        const stopsIdx = gps ? geocodedIdx : geocodedIdx.slice(1);
        const result = optimizeRoute(start, stopsCoords);
        setRoute(result);
        const optimized: OrderedStop[] = gps
          ? result.order.map((r) => ({ address: addresses[stopsIdx[r]], coord: stopsCoords[r] }))
          : [
              { address: addresses[geocodedIdx[0]], coord: geocodedCoords[0] },
              ...result.order.map((r) => ({ address: addresses[stopsIdx[r]], coord: stopsCoords[r] })),
            ];
        ordered = [...optimized, ...failedIdx.map((i) => ({ address: addresses[i], coord: null }))];
      } else {
        ordered = addresses.map((a, i) => ({ address: a, coord: coords[i] }));
      }

      setStops(ordered);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setStatusText('Something went wrong building the route.');
    }
  }

  function openInMaps() {
    if (!stops.length) return;
    const waypoints = stops.map((s) => encodeURIComponent(s.address.full)).join('/');
    const url = `https://www.google.com/maps/dir/My+Location/${waypoints}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open Google Maps', 'Make sure Google Maps is installed.')
    );
  }

  function copyPrompt() {
    const prompt = buildRoutePrompt(stops, hasGPS);
    Clipboard.setString(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const routePrompt = status === 'ready' ? buildRoutePrompt(stops, hasGPS) : '';
  const failedCount = stops.filter((s) => s.coord === null).length;
  const loading = status !== 'ready' && status !== 'error';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Route</Text>
        </View>

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>{statusText}</Text>
            <Text style={styles.loadingNote}>
              {addresses.length} stop{addresses.length > 1 ? 's' : ''} — ~{addresses.length * 2 + 1}s
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{statusText}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={buildRoute}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'ready' && (
          <>
            {/* Route prompt card */}
            <View style={styles.promptCard}>
              <Text style={styles.promptLabel}>ROUTE SUMMARY</Text>
              <Text style={styles.promptText}>{routePrompt}</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={copyPrompt}>
                <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy text'}</Text>
              </TouchableOpacity>
            </View>

            {/* Distance summary */}
            {route && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipValue}>{kmToDisplay(route.totalKm)}</Text>
                  <Text style={styles.summaryChipLabel}>total</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipValue}>{stops.length}</Text>
                  <Text style={styles.summaryChipLabel}>stop{stops.length > 1 ? 's' : ''}</Text>
                </View>
                {failedCount > 0 && (
                  <View style={[styles.summaryChip, styles.summaryChipWarn]}>
                    <Text style={styles.summaryChipValue}>{failedCount}</Text>
                    <Text style={styles.summaryChipLabel}>unmapped</Text>
                  </View>
                )}
              </View>
            )}

            {/* Stop list */}
            {stops.map((stop, i) => {
              const failed = stop.coord === null;
              const legDist =
                route && !failed && route.legKm[i] != null && i > 0
                  ? `+${kmToDisplay(route.legKm[i])}`
                  : i === 0 ? 'First stop' : null;
              return (
                <View key={i} style={[styles.stopCard, failed && styles.stopCardFailed]}>
                  <View style={[styles.badge, failed && styles.badgeFailed]}>
                    <Text style={styles.badgeText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stopInfo}>
                    <Text style={styles.stopStreet}>{stop.address.street}</Text>
                    <Text style={styles.stopCity}>
                      {stop.address.city}, {stop.address.state}
                      {stop.address.zip ? ` ${stop.address.zip}` : ''}
                    </Text>
                    {legDist && (
                      <Text style={[styles.stopDist, failed && styles.stopDistWarn]}>
                        {legDist}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            <TouchableOpacity style={styles.mapsBtn} onPress={openInMaps}>
              <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A5F' },

  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 14 },
  loadingText: { fontSize: 16, fontWeight: '600', color: '#1E3A5F' },
  loadingNote: { fontSize: 13, color: '#64748B' },

  errorBox: { alignItems: 'center', paddingVertical: 32, gap: 16 },
  errorText: { fontSize: 15, color: '#DC2626', textAlign: 'center' },
  retryBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  retryBtnText: { color: '#fff', fontWeight: '700' },

  promptCard: {
    backgroundColor: '#1E3A5F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  promptText: {
    fontSize: 16,
    color: '#F0F9FF',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  copyBtn: {
    alignSelf: 'flex-end',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  copyBtnText: { color: '#BAE6FD', fontSize: 12, fontWeight: '600' },

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  summaryChipWarn: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  summaryChipValue: { fontSize: 20, fontWeight: '800', color: '#1E3A5F' },
  summaryChipLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },

  stopCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stopCardFailed: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  badge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#2563EB',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, marginTop: 2,
  },
  badgeFailed: { backgroundColor: '#D97706' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stopInfo: { flex: 1 },
  stopStreet: { fontSize: 15, fontWeight: '600', color: '#1E3A5F' },
  stopCity: { fontSize: 13, color: '#64748B', marginTop: 2 },
  stopDist: { fontSize: 12, color: '#2563EB', marginTop: 4, fontWeight: '600' },
  stopDistWarn: { color: '#D97706' },

  mapsBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  mapsBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
