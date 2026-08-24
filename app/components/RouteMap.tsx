import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LatLng } from '../utils/geocoding';

type StopStatus = 'pending' | 'active' | 'delivered';

export interface RouteMapProps {
  stops: Array<{ coord: LatLng; label: string; status: StopStatus }>;
  startCoord?: LatLng | null;
}

export default function RouteMap({ stops }: RouteMapProps) {
  if (stops.length === 0) return null;
  return (
    <View style={s.box}>
      <Text style={s.text}>Map available on web</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { height: 80, backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#94A3B8', fontSize: 13 },
});
