import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, SafeAreaView, Linking, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { ParsedAddress } from '../utils/addressParser';
import { geocodeAddress, LatLng } from '../utils/geocoding';
import { optimizeRoute, RouteResult, kmToDisplay } from '../utils/routing';
import RouteMap from '../components/RouteMap';

interface Props {
  addresses: ParsedAddress[];
  onBack: () => void;
}

type StopStatus = 'pending' | 'active' | 'delivered';

interface Stop {
  address: ParsedAddress;
  coord: LatLng | null;
  status: StopStatus;
}

const BLUE = '#2563EB';
const GREEN = '#16A34A';

function timeEst(km: number, stops: number): string {
  const min = Math.round((km / 25) * 60 + stops * 3);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RouteView({ addresses, onBack }: Props) {
  const [phase, setPhase] = useState<'locating' | 'geocoding' | 'optimizing' | 'ready' | 'error'>('locating');
  const [phaseText, setPhaseText] = useState('Getting your location...');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [gps, setGps] = useState<LatLng | null>(null);
  const [started, setStarted] = useState(false);
  const [curIdx, setCurIdx] = useState(0);

  useEffect(() => { buildRoute(); }, []);

  async function buildRoute() {
    try {
      setPhase('locating');
      setPhaseText('Getting your location...');

      let coord: LatLng | null = null;
      try {
        if (Platform.OS !== 'web') {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            coord = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
        } else {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coord = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      } catch (_) {}
      setGps(coord);

      setPhase('geocoding');
      const coords: (LatLng | null)[] = [];
      for (let i = 0; i < addresses.length; i++) {
        setPhaseText(`Looking up address ${i + 1} of ${addresses.length}...`);
        coords.push(await geocodeAddress(addresses[i].full));
      }

      setPhase('optimizing');
      setPhaseText('Optimizing route...');
      await new Promise(r => setTimeout(r, 50));

      const geocodedIdx = coords.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
      const failedIdx = coords.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
      let ordered: Stop[] = [];

      if (geocodedIdx.length >= 2) {
        const gc = geocodedIdx.map(i => coords[i] as LatLng);
        const start = coord ?? gc[0];
        const sc = coord ? gc : gc.slice(1);
        const si = coord ? geocodedIdx : geocodedIdx.slice(1);
        const r = optimizeRoute(start, sc);
        setRoute(r);
        const optimized: Stop[] = coord
          ? r.order.map(o => ({ address: addresses[si[o]], coord: sc[o], status: 'pending' as StopStatus }))
          : [
              { address: addresses[geocodedIdx[0]], coord: gc[0], status: 'pending' as StopStatus },
              ...r.order.map(o => ({ address: addresses[si[o]], coord: sc[o], status: 'pending' as StopStatus })),
            ];
        ordered = [...optimized, ...failedIdx.map(i => ({ address: addresses[i], coord: null, status: 'pending' as StopStatus }))];
      } else {
        ordered = addresses.map((a, i) => ({ address: a, coord: coords[i] ?? null, status: 'pending' as StopStatus }));
      }

      setStops(ordered);
      setPhase('ready');
    } catch {
      setPhase('error');
      setPhaseText('Could not build route.');
    }
  }

  function begin() {
    setStarted(true);
    setCurIdx(0);
    setStops(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' })));
  }

  function markDelivered() {
    setStops(prev => prev.map((s, i) => {
      if (i === curIdx) return { ...s, status: 'delivered' };
      if (i === curIdx + 1) return { ...s, status: 'active' };
      return s;
    }));
    setCurIdx(c => c + 1);
  }

  function navigateTo(stop: Stop) {
    Linking.openURL(
      `https://www.google.com/maps/dir/My+Location/${encodeURIComponent(stop.address.full)}`
    ).catch(() => {});
  }

  function move(from: number, dir: -1 | 1) {
    const to = from + dir;
    if (to < 0 || to >= stops.length) return;
    const next = [...stops];
    [next[from], next[to]] = [next[to], next[from]];
    setStops(next);
  }

  const doneCount = stops.filter(s => s.status === 'delivered').length;
  const cur = started && curIdx < stops.length ? stops[curIdx] : null;
  const allDone = started && stops.length > 0 && doneCount === stops.length;
  const loading = phase !== 'ready' && phase !== 'error';

  const mapStops = stops
    .filter(s => s.coord !== null)
    .map(s => ({ coord: s.coord as LatLng, label: s.address.street, status: s.status }));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.back}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Today's Route</Text>
          {phase === 'ready' && (
            <Text style={s.subtitle}>
              {doneCount > 0 ? `${doneCount} of ${stops.length} done` : `${stops.length} stops`}
            </Text>
          )}
        </View>
      </View>

      {loading && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BLUE} />
          <Text style={s.loadT}>{phaseText}</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={s.center}>
          <Text style={s.errT}>{phaseText}</Text>
          <TouchableOpacity onPress={buildRoute} style={s.retry}>
            <Text style={s.retryT}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'ready' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Stats */}
          <View style={s.stats}>
            {[
              { v: String(stops.length), l: 'deliveries' },
              { v: route ? kmToDisplay(route.totalKm) : '—', l: 'distance' },
              { v: route ? timeEst(route.totalKm, stops.length) : '—', l: 'est. time' },
              { v: `${doneCount}/${stops.length}`, l: 'done', g: doneCount > 0 },
            ].map(({ v, l, g }) => (
              <View key={l} style={s.stat}>
                <Text style={[s.statV, g && s.statG]}>{v}</Text>
                <Text style={s.statL}>{l}</Text>
              </View>
            ))}
          </View>

          {/* Map */}
          {mapStops.length > 0 && (
            <RouteMap stops={mapStops} startCoord={gps} />
          )}

          {/* Start button */}
          {!started && (
            <TouchableOpacity style={s.startBtn} onPress={begin}>
              <Text style={s.startBtnT}>Start Route</Text>
            </TouchableOpacity>
          )}

          {/* All done */}
          {allDone && (
            <View style={s.allDone}>
              <Text style={s.allDoneT}>All deliveries complete</Text>
              <Text style={s.allDoneS}>{stops.length} stops · {route ? kmToDisplay(route.totalKm) : ''}</Text>
            </View>
          )}

          {/* Next stop card */}
          {started && !allDone && cur && (
            <View style={s.next}>
              <Text style={s.nextL}>Next stop  ·  {curIdx + 1} of {stops.length}</Text>
              <Text style={s.nextStreet}>{cur.address.street}</Text>
              <Text style={s.nextCity}>
                {cur.address.city}, {cur.address.state}
                {cur.address.zip ? ` ${cur.address.zip}` : ''}
              </Text>
              <View style={s.nextActs}>
                <TouchableOpacity style={s.navBtn} onPress={() => navigateTo(cur)}>
                  <Text style={s.navBtnT}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.doneBtn} onPress={markDelivered}>
                  <Text style={s.doneBtnT}>Mark delivered</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Route list */}
          <Text style={s.section}>Route</Text>

          {stops.map((stop, i) => {
            const done = stop.status === 'delivered';
            const active = stop.status === 'active';
            return (
              <View key={i} style={[s.row, done && s.rowDone]}>
                <View style={[s.num, done ? s.numDone : active ? s.numActive : s.numPending]}>
                  <Text style={[s.numT, !done && !active && s.numTPending]}>
                    {done ? '✓' : i + 1}
                  </Text>
                </View>
                <View style={s.rowInfo}>
                  <Text style={[s.rowStreet, done && s.rowStrike]}>{stop.address.street}</Text>
                  <Text style={[s.rowCity, done && s.rowFaded]}>
                    {stop.address.city}, {stop.address.state}
                    {stop.address.zip ? ` ${stop.address.zip}` : ''}
                  </Text>
                </View>
                {!started && (
                  <View style={s.arrows}>
                    <TouchableOpacity onPress={() => move(i, -1)} style={s.arrow}>
                      <Text style={s.arrowT}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => move(i, 1)} style={s.arrow}>
                      <Text style={s.arrowT}>↓</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* Open all in Maps */}
          {stops.length > 0 && (
            <TouchableOpacity
              style={s.mapsBtn}
              onPress={() => {
                const wp = stops.map(st => encodeURIComponent(st.address.full)).join('/');
                Linking.openURL(`https://www.google.com/maps/dir/My+Location/${wp}`).catch(() => {});
              }}
            >
              <Text style={s.mapsBtnT}>Open all in Google Maps</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  back: { padding: 4 },
  backT: { fontSize: 22, color: BLUE },
  title: { fontSize: 18, color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  loadT: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  errT: { fontSize: 15, color: '#DC2626', textAlign: 'center' },
  retry: { backgroundColor: BLUE, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  retryT: { color: '#fff', fontSize: 14 },

  scroll: { padding: 16, paddingBottom: 48, gap: 14 },

  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statV: { fontSize: 17, color: '#0F172A', marginBottom: 2 },
  statG: { color: GREEN },
  statL: { fontSize: 10, color: '#94A3B8', letterSpacing: 0.5 },

  startBtn: { backgroundColor: BLUE, borderRadius: 16, paddingVertical: 20, alignItems: 'center' },
  startBtnT: { color: '#fff', fontSize: 18 },

  allDone: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  allDoneT: { fontSize: 18, color: GREEN, marginBottom: 4 },
  allDoneS: { fontSize: 13, color: '#64748B' },

  next: { backgroundColor: BLUE, borderRadius: 18, padding: 20 },
  nextL: { fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, marginBottom: 10 },
  nextStreet: { fontSize: 22, color: '#fff', marginBottom: 4 },
  nextCity: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 18 },
  nextActs: { flexDirection: 'row', gap: 10 },
  navBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  navBtnT: { color: '#fff', fontSize: 15 },
  doneBtn: { flex: 1, backgroundColor: GREEN, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  doneBtnT: { color: '#fff', fontSize: 15 },

  section: { fontSize: 11, color: '#94A3B8', letterSpacing: 1, marginTop: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 14,
  },
  rowDone: { opacity: 0.45 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numPending: { backgroundColor: '#E2E8F0' },
  numActive: { backgroundColor: BLUE },
  numDone: { backgroundColor: GREEN },
  numT: { fontSize: 13, color: '#fff' },
  numTPending: { color: '#64748B' },
  rowInfo: { flex: 1 },
  rowStreet: { fontSize: 15, color: '#0F172A' },
  rowCity: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowStrike: { textDecorationLine: 'line-through', color: '#94A3B8' },
  rowFaded: { color: '#94A3B8' },

  arrows: { flexDirection: 'row', gap: 4 },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowT: { fontSize: 14, color: '#64748B' },

  mapsBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    marginTop: 4,
  },
  mapsBtnT: { color: '#0F172A', fontSize: 15 },
});
