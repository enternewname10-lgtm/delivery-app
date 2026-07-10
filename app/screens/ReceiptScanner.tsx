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
import { parseAddresses, ParsedAddress } from '../utils/addressParser';
import AddressCard from '../components/AddressCard';

export default function ReceiptScanner() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [ocrDebug, setOcrDebug] = useState('');
  const [addresses, setAddresses] = useState<ParsedAddress[]>([]);
  const [lastAdded, setLastAdded] = useState<number | null>(null);

  async function scanWithCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to scan receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled) await processImages([result.assets[0].uri]);
  }

  async function uploadPhotos() {
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
    if (!result.canceled && result.assets.length > 0) {
      await processImages([result.assets[0].uri]);
    }
  }

  async function processImages(uris: string[]) {
    setProcessing(true);
    setOcrDebug('');
    let found = 0;
    let failed = 0;
    let lastRawText = '';

    for (let i = 0; i < uris.length; i++) {
      setImageUri(uris[i]);
      setStatusText(uris.length > 1 ? `Reading receipt ${i + 1} of ${uris.length}...` : 'Reading receipt...');

      try {
        const text = await runOCR(uris[i]);
        lastRawText = text;
        const foundAddresses = parseAddresses(text);
        if (foundAddresses.length > 0) {
          found += foundAddresses.length;
          setAddresses((prev) => {
            const next = [...prev, ...foundAddresses];
            setLastAdded(next.length - 1);
            return next;
          });
        } else {
          failed++;
        }
      } catch (e: unknown) {
        failed++;
        lastRawText = e instanceof Error ? `Error: ${e.message}` : 'Unknown error';
      }
    }

    setProcessing(false);

    if (found > 0) {
      setStatusText(`${found} address${found > 1 ? 'es' : ''} added to queue`);
      setTimeout(() => setStatusText(''), 3000);
      setOcrDebug('');
    } else {
      setStatusText('');
      // Show raw OCR output so we can see what went wrong
      setOcrDebug(lastRawText ? `OCR read:\n"${lastRawText.slice(0, 300)}"` : 'OCR returned nothing — key may be rate limited');
    }
  }

  function removeAddress(index: number) {
    setAddresses((prev) => prev.filter((_, i) => i !== index));
    if (lastAdded === index) setLastAdded(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <Text style={styles.title}>Scan Receipts</Text>
        <Text style={styles.subtitle}>
          Scan up to 5 receipts — addresses appear in the queue below automatically
        </Text>

        {/* Status banner */}
        {statusText !== '' && (
          <View style={[styles.statusBanner, processing ? styles.statusProcessing : styles.statusSuccess]}>
            {processing && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

        {/* Debug: show raw OCR output when address isn't found */}
        {ocrDebug !== '' && (
          <View style={styles.debugBox}>
            <Text style={styles.debugLabel}>Could not find address. What OCR saw:</Text>
            <Text style={styles.debugText}>{ocrDebug}</Text>
          </View>
        )}

        {/* Image preview — stays visible until next scan begins */}
        {imageUri && (
          <View style={styles.previewBox}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            {processing && (
              <View style={styles.previewOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
          </View>
        )}

        {/* Scan buttons — always visible, dimmed while processing */}
        <View style={[styles.buttonGroup, processing && styles.dimmed]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={scanWithCamera}
            disabled={processing}
          >
            <Text style={styles.primaryBtnText}>Scan with Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={uploadPhotos}
            disabled={processing}
          >
            <Text style={styles.secondaryBtnText}>Upload Photos (up to 5)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={uploadDocument}
            disabled={processing}
          >
            <Text style={styles.secondaryBtnText}>Upload PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Delivery queue */}
        <View style={styles.queueSection}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Delivery Queue</Text>
            {addresses.length > 0 && (
              <View style={styles.queueBadge}>
                <Text style={styles.queueBadgeText}>{addresses.length}</Text>
              </View>
            )}
          </View>

          {addresses.length === 0 ? (
            <View style={styles.emptyQueue}>
              <Text style={styles.emptyQueueText}>
                No addresses yet — scan a receipt above and the address will appear here
              </Text>
            </View>
          ) : (
            <>
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
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: '#1E3A5F', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statusProcessing: { backgroundColor: '#2563EB' },
  statusSuccess: { backgroundColor: '#16A34A' },
  statusText: { color: '#fff', fontWeight: '600', fontSize: 14 },

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
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonGroup: { gap: 10, marginBottom: 28 },
  dimmed: { opacity: 0.5 },

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

  queueSection: { marginTop: 4 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  queueTitle: { fontSize: 17, fontWeight: '700', color: '#1E3A5F' },
  queueBadge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  queueBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  emptyQueue: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptyQueueText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

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

  debugBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 12,
    marginBottom: 14,
  },
  debugLabel: { fontSize: 12, fontWeight: '700', color: '#C2410C', marginBottom: 6 },
  debugText: { fontSize: 11, color: '#7C2D12', fontFamily: 'monospace' },
});
