import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { runOCR } from '../utils/ocr';
import { parseAddress, ParsedAddress } from '../utils/addressParser';
import AddressCard from '../components/AddressCard';

export default function ReceiptScanner() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [addresses, setAddresses] = useState<ParsedAddress[]>([]);
  const [lastAdded, setLastAdded] = useState<number | null>(null);

  async function scanWithCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to scan receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled) await processImage(result.assets[0].uri);
  }

  async function uploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      await processImages(result.assets.map((a) => a.uri));
    }
  }

  async function uploadDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) await processImage(result.assets[0].uri);
  }

  async function processImages(uris: string[]) {
    setProcessing(true);
    let failed = 0;
    let found = 0;

    for (let i = 0; i < uris.length; i++) {
      setImageUri(uris[i]);
      setProgressLabel(uris.length > 1 ? `Reading receipt ${i + 1} of ${uris.length}...` : 'Reading receipt...');
      try {
        const text = await runOCR(uris[i]);
        const address = parseAddress(text);
        if (address) {
          found++;
          setAddresses((prev) => {
            const next = [...prev, address];
            setLastAdded(next.length - 1);
            return next;
          });
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setProcessing(false);
    setImageUri(null);
    setProgressLabel('');

    if (failed > 0) {
      const msg =
        found > 0
          ? `${found} address${found > 1 ? 'es' : ''} added. Could not read ${failed} receipt${failed > 1 ? 's' : ''} — try clearer photos.`
          : `Could not find an address on ${failed > 1 ? 'any of those receipts' : 'that receipt'}. Try a clearer photo.`;
      Alert.alert('Some receipts skipped', msg);
    }
  }

  async function processImage(uri: string) {
    await processImages([uri]);
  }

  function removeAddress(index: number) {
    setAddresses((prev) => prev.filter((_, i) => i !== index));
    setLastAdded(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Scan Receipt</Text>
        <Text style={styles.subtitle}>
          Scan or upload a receipt — the address shows at the bottom automatically
        </Text>

        {/* Image preview while processing */}
        {imageUri && (
          <View style={styles.previewBox}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          </View>
        )}

        {/* Processing spinner */}
        {processing ? (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.processingText}>{progressLabel || 'Reading receipt...'}</Text>
          </View>
        ) : (
          /* Scan buttons — always visible unless processing */
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.primaryBtn} onPress={scanWithCamera}>
              <Text style={styles.primaryBtnText}>Scan with Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={uploadPhoto}>
              <Text style={styles.secondaryBtnText}>Upload Photos (up to 5)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={uploadDocument}>
              <Text style={styles.secondaryBtnText}>Upload PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery queue */}
        {addresses.length > 0 && (
          <View style={styles.queueSection}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>Delivery Queue</Text>
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{addresses.length}</Text>
              </View>
            </View>

            {addresses.map((addr, i) => (
              <View key={i}>
                {lastAdded === i && (
                  <Text style={styles.newTag}>Just added</Text>
                )}
                <AddressCard
                  address={addr}
                  index={i + 1}
                  onRemove={() => removeAddress(i)}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.routeBtn}>
              <Text style={styles.routeBtnText}>Start Route</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#1E3A5F', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  previewBox: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    height: 200,
  },
  preview: { width: '100%', height: '100%' },
  processingBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  processingText: { fontSize: 15, color: '#64748B' },
  buttonGroup: { gap: 10, marginBottom: 32 },
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryBtnText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
  queueSection: { marginTop: 8 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  queueTitle: { fontSize: 17, fontWeight: '700', color: '#1E3A5F' },
  queueBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  queueBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  newTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  routeBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  routeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
