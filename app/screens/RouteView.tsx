import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, SafeAreaView, Linking, Alert, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { ParsedAddress } from '../utils/addressParser';
import { geocodeAddress, LatLng } from '../utils/geocoding';
import { optimizeRoute, RouteResult, kmToDisplay } from '../utils/routing';
import RouteMap from '../components/RouteMap.web';

interface Props {
  addresses: ParsedAddress[];
  onBack: () => void;
}

type Status = 'locating' | 'geocoding' | 'optimizing' | 'ready' | 'error';

interface OrderedStop {
  address: ParsedAddress;
  coord: LatLng | null;
}

export default function RouteView({ addresses, onBack }: Props) {
  const [status, setStatus] = useState<Status>('locating');
  const [statusText, setStatusText] = useState('Getting your location...');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stops, setStops] = useState<OrderedStop[]>([]);
  const [startCoord, setStartCoord] = useState<LatLng | null>(null);

  useEffect(() => { buildRoute(); }, []);

  async function buildRoute() {
    try {
      // Step 1: GPS
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
      setStartCoord(gps);

      // Step 2: Geocode all addresses (with retry on failure)
      setStatus('geocoding');
      const coords: (LatLng | null)[] = [];
      for (let i = 0; i < addresses.length; i++) {
        setStatusText(`Looking up address ${i + 1} of ${addresses.length}…`);
        coords.push(await geocodeAddress(addresses[i].full));
      }

      // Step 3: Optimize the addresses we could geocode
      setStatus('optimizing');
      setStatusText('Calculating fastest route…');
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

        const optimizedGeocoded: OrderedStop[] = gps
          ? result.order.map((r) => ({ address: addresses[stopsIdx[r]], coord: stopsCoords[r] }))
          : [
              { address: addresses[geocodedIdx[0]], coord: geocodedCoords[0] },
              ...result.order.map((r) => ({ address: addresses[stopsIdx[r]], coord: stopsCoords[r] })),
            ];

        ordered = [
          ...optimizedGeocoded,
          ...failedIdx.map((i) => ({ address: addresses[i], coord: null })),
        ];
      } else {
        // Can't optimize — use original order, include everything
        ordered = addresses.map((a, i) => ({ address: a, coord: coords[i] }));
        setRoute(null);
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

  const geocodedStops = stops.filter((s) => s.coord !== null);
  const mapCoords = geocodedStops.map((s) => s.coord as LatLng);
  const mapLabels = geocodedStops.map((s) => s.address.street);
  const failedCount = stops.filter((s) => s.coord === null).length;
  const loading = status !== 'ready' && status !== 'error';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Optimized Route</Text>
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
            {/* Embedded map */}
            {mapCoords.length > 0 && Platform.OS === 'web' && (
              <View style={styles.mapBox}>
                <RouteMap stops={mapCoords} stopLabels={mapLabels} startCoord={startCoord} />
              </View>
            )}

            {/* Summary */}
            <View style={styles.summaryBox}>
              {route && (
                <Text style={styles.summaryValue}>{kmToDisplay(route.totalKm)}</Text>
              )}
              <Text style={styles.summaryStops}>
                {stops.length} stop{stops.length > 1 ? 's' : ''}
                {failedCount > 0
                  ? ` • ${failedCount} could not be mapped`
                  : ' • fastest order'}
              </Text>
            </View>

            {/* Stop list */}
            {stops.map((stop, i) => {
              const failed = stop.coord === null;
              const legDist = route && !failed && route.legKm[i] != null && i > 0
                ? `+${kmToDisplay(route.legKm[i])} from previous`
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
                    {legDist && <Text style={styles.stopDist}>{legDist}</Text>}
                    {failed && (
                      <Text style={styles.stopWarning}>Could not map — Google Maps will still navigate</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Google Maps navigation button */}
            <TouchableOpacity style={styles.mapsBtn} onPress={openInMaps}>
              <Text style={styles.mapsBtnText}>Start Navigation in Google Maps</Text>
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

  mapBox: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },

  summaryBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  summaryValue: { fontSize: 34, fontWeight: '800', color: '#1E3A5F', marginBottom: 2 },
  summaryStops: { fontSize: 13, color: '#64748B' },

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
  stopDist: { fontSize: 12, color: '#2563EB', marginTop: 4, fontWeight: '500' },
  stopWarning: { fontSize: 11, color: '#92400E', marginTop: 4 },

  mapsBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  mapsBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
