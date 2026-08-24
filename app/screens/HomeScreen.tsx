import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

interface Props {
  onStart: () => void;
}

export default function HomeScreen({ onStart }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1A3A6B', '#A8D4EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />

      <View style={[StyleSheet.absoluteFill, styles.blueOverlay]} pointerEvents="none" />

      <SafeAreaView style={styles.safe}>
        <View style={styles.brandArea}>
          <Text style={styles.appName}>Delivery</Text>
          <Text style={styles.tagline}>Route optimizer</Text>
        </View>

        <View style={styles.card}>
          {['Scan receipts', 'Find the fastest route', 'Open in Google Maps'].map((item, i, arr) => (
            <View key={item}>
              <Text style={styles.cardItem}>{item}</Text>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.75}>
          <Text style={styles.startBtnText}>Get started</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Scan · Optimize · Navigate</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blueOverlay: { backgroundColor: 'rgba(186, 225, 255, 0.28)' },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },
  brandArea: { alignItems: 'center', gap: 8 },
  appName: {
    fontFamily: 'Arial',
    fontSize: 58,
    fontWeight: 'normal',
    color: '#0D1F3C',
    letterSpacing: 1,
  },
  tagline: {
    fontFamily: 'Arial',
    fontSize: 14,
    fontWeight: 'normal',
    color: '#2A4E7F',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  cardItem: {
    fontFamily: 'Arial',
    fontSize: 15,
    fontWeight: 'normal',
    color: '#0D1F3C',
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  startBtn: {
    borderWidth: 1.5,
    borderColor: '#0D1F3C',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(13,31,60,0.08)',
  },
  startBtnText: {
    fontFamily: 'Arial',
    color: '#0D1F3C',
    fontSize: 16,
    fontWeight: 'normal',
    letterSpacing: 0.5,
  },
  footer: {
    fontFamily: 'Arial',
    fontSize: 11,
    fontWeight: 'normal',
    color: '#2A4E7F',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
});
