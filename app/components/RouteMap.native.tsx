import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RouteMapProps } from './RouteMap.web';

// Native stub — map is web-only for now
export default function RouteMap({ stops }: RouteMapProps) {
  if (stops.length === 0) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.text}>Map preview available on web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 80, backgroundColor: '#F1F5F9', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  text: { color: '#94A3B8', fontSize: 13 },
});
