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
      {/* City-sky gradient background */}
      <LinearGradient
        colors={['#0B1A2E', '#1A3A6B', '#2E6CB0', '#5BA4CF', '#A8D4EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Blur layer over the gradient */}
      <BlurView intensity={22} tint="light" style={StyleSheet.absoluteFill} />

      {/* Light blue transparent overlay */}
      <View
        style={[StyleSheet.absoluteFill, styles.blueOverlay]}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.brandArea}>
          <Text style={styles.icon}>🚚</Text>
          <Text style={styles.appName}>DLeivery</Text>
          <Text style={styles.tagline}>Smart Delivery Route Optimizer</Text>
        </View>

        <View style={styles.card}>
          {[
            { emoji: '📸', label: 'Scan receipts' },
            { emoji: '🗺️', label: 'Optimize your route' },
            { emoji: '📍', label: 'Navigate in Google Maps' },
          ].map(({ emoji, label }) => (
            <View key={label} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{emoji}</Text>
              <Text style={styles.featureText}>{label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Start Deliveries  →</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Scan · Optimize · Navigate</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blueOverlay: { backgroundColor: 'rgba(186, 225, 255, 0.32)' },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 28,
  },
  brandArea: { alignItems: 'center', gap: 8 },
  icon: { fontSize: 68 },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#08182E',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(255,255,255,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#1A3A6B',
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderRadius: 22,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureEmoji: { fontSize: 22 },
  featureText: { fontSize: 16, color: '#0F2848', fontWeight: '600' },
  startBtn: {
    backgroundColor: '#1A3A6B',
    borderRadius: 18,
    paddingVertical: 19,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  startBtnText: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },
  footer: { color: '#1A3A6B', fontSize: 12, opacity: 0.6, textAlign: 'center' },
});
