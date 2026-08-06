import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, ScrollView, Alert, SafeAreaView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { runOCR, runOCRDirect } from '../utils/ocr';
import { parseAddresses, ParsedAddress } from '../utils/addressParser';
import AddressCard from '../components/AddressCard';

interface Props {
  onStartRoute: (addresses: ParsedAddress[]) => void;
}

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1536, height: 2048 });
      img.src = uri;
    });
  }
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      () => resolve({ width: 1536, height: 2048 })
    );
  });
}

export default function ReceiptScanner({ onStartRoute }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<ParsedAddress[]>([]);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [receiptCount, setReceiptCount] = useState(1);

  async function pickCamera() {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
        await processSingle(result.assets[0].uri);
      }
    } catch (e) { Alert.alert('Camera error', e instanceof Error ? e.message : 'Could not open camera'); }
  }

  async function pickPhotos() {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: 5,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uris = result.assets.map((a) => a.uri);
        setImageUri(uris[0]);
        // Multiple files selected = each is one receipt → process individually
        if (uris.length > 1) {
          await processImages(uris);
        } else {
          // Single file selected → might be multi-receipt photo, use current receiptCount
          if (receiptCount > 1) {
            await processMultiReceipt(uris[0], receiptCount);
          } else {
            await processSingle(uris[0]);
          }
        }
      }
    } catch (e) { Alert.alert('Upload error', e instanceof Error ? e.message : 'Could not open photo library'); }
  }

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (!result.canceled && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        await processSingle(result.assets[0].uri);
      }
    } catch (e) { Alert.alert('Upload error', e instanceof Error ? e.message : 'Could not open document picker'); }
  }

  // Single receipt: standard OCR on the whole image
  async function processSingle(uri: string) {
    await processImages([uri]);
  }

  // Standard sequential OCR — one call per URI
  async function processImages(uris: string[]) {
    setProcessing(true);
    setDebugLines([]);
    let totalFound = 0;
    const missed: string[] = [];

    for (let i = 0; i < uris.length; i++) {
      setImageUri(uris[i]);
      setStatusText(uris.length > 1 ? `Reading receipt ${i + 1} of ${uris.length}…` : 'Reading receipt…');
      try {
        const text = await runOCR(uris[i]);
        const found = parseAddresses(text);
        if (found.length > 0) {
          totalFound += found.length;
          setAddresses((prev) => { const next = [...prev, ...found]; setLastAdded(next.length - 1); return next; });
        } else {
          missed.push(`Photo ${i + 1}: "${text.replace(/\n+/g, ' ').trim().slice(0, 100) || 'nothing'}"`);
        }
      } catch (e) {
        missed.push(`Photo ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    setProcessing(false);
    if (totalFound > 0) { setStatusText(`${totalFound} address${totalFound > 1 ? 'es' : ''} added`); setTimeout(() => setStatusText(''), 3000); }
    else setStatusText('');
    setDebugLines(missed);
  }

  // Multi-receipt: crop image into N vertical strips, rotate each 90°, OCR each strip separately
  async function processMultiReceipt(uri: string, count: number) {
    setProcessing(true);
    setDebugLines([]);
    let totalFound = 0;
    const missed: string[] = [];

    const dims = await getImageDimensions(uri);
    const stripW = Math.floor(dims.width / count);

    for (let i = 0; i < count; i++) {
      setStatusText(`Scanning receipt ${i + 1} of ${count}…`);
      try {
        const x = i * stripW;
        const w = i === count - 1 ? dims.width - x : stripW;

        const ctx = ImageManipulator.manipulate(uri);
        ctx.crop({ originX: x, originY: 0, width: w, height: dims.height });
        ctx.rotate(90); // receipts are sideways when photographed in portrait mode
        const img = await ctx.renderAsync();
        const stripped = await img.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
        ctx.release();
        img.release();

        const text = await runOCRDirect(stripped.uri);
        const found = parseAddresses(text);
        if (found.length > 0) {
          totalFound += found.length;
          setAddresses((prev) => { const next = [...prev, ...found]; setLastAdded(next.length - 1); return next; });
        } else {
          missed.push(`Receipt ${i + 1}: "${text.replace(/\n+/g, ' ').trim().slice(0, 100) || 'nothing'}"`);
        }
      } catch (e) {
        missed.push(`Receipt ${i + 1}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    setProcessing(false);
    if (totalFound > 0) { setStatusText(`${totalFound} address${totalFound > 1 ? 'es' : ''} added`); setTimeout(() => setStatusText(''), 3000); }
    else setStatusText('');
    setDebugLines(missed);
  }

  async function rotateAndRescan() {
    if (!imageUri || processing) return;
    setProcessing(true);
    setStatusText('Rotating…');
    try {
      const ctx = ImageManipulator.manipulate(imageUri);
      ctx.rotate(90);
      const img = await ctx.renderAsync();
      const result = await img.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      ctx.release();
      img.release();
      setImageUri(result.uri);
      if (receiptCount > 1) await processMultiReceipt(result.uri, receiptCount);
      else await processImages([result.uri]);
    } catch (e) {
      setProcessing(false);
      setStatusText('');
      Alert.alert('Rotate failed', e instanceof Error ? e.message : 'Unknown error');
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
        <Text style={styles.subtitle}>Scan or upload receipts — addresses appear in the queue below</Text>

        {statusText !== '' && (
          <View style={[styles.statusBanner, processing ? styles.statusProcessing : styles.statusSuccess]}>
            {processing && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

        {/* Receipt count selector */}
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Receipts in photo:</Text>
          {[1, 2, 3, 4].map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.countBtn, receiptCount === n && styles.countBtnActive]}
              onPress={() => setReceiptCount(n)}
              disabled={processing}
            >
              <Text style={[styles.countBtnText, receiptCount === n && styles.countBtnTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {receiptCount > 1 && (
          <Text style={styles.countHint}>
            Photo will be split into {receiptCount} strips — receipts must be laid side by side horizontally
          </Text>
        )}

        {/* Image preview */}
        {imageUri && (
          <View style={styles.previewBox}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            {processing && (
              <View style={styles.previewOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            {!processing && (
              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.previewBtn} onPress={rotateAndRescan}>
                  <Text style={styles.previewBtnText}>↻ Rotate</Text>
                </TouchableOpacity>
                {receiptCount > 1 && (
                  <TouchableOpacity style={[styles.previewBtn, styles.previewBtnGreen]}
                    onPress={() => processMultiReceipt(imageUri, receiptCount)}>
                    <Text style={styles.previewBtnText}>Scan {receiptCount} receipts</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Scan buttons */}
        <View style={[styles.buttonGroup, processing && styles.dimmed]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={pickCamera} disabled={processing}>
            <Text style={styles.primaryBtnText}>Scan with Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickPhotos} disabled={processing}>
            <Text style={styles.secondaryBtnText}>Upload Photos (up to 5)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={pickDocument} disabled={processing}>
            <Text style={styles.secondaryBtnText}>Upload PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Debug output */}
        {debugLines.length > 0 && (
          <View style={styles.debugBox}>
            <Text style={styles.debugLabel}>
              {debugLines.length} receipt{debugLines.length > 1 ? 's' : ''} could not be read:
            </Text>
            {debugLines.map((line, i) => <Text key={i} style={styles.debugText}>{line}</Text>)}
          </View>
        )}

        {/* Delivery queue */}
        <View style={styles.queueSection}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Delivery Queue</Text>
            {addresses.length > 0 && (
              <View style={styles.queueBadge}><Text style={styles.queueBadgeText}>{addresses.length}</Text></View>
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
                  {lastAdded === i && <Text style={styles.newTag}>Just added</Text>}
                  <AddressCard address={addr} index={i + 1} onRemove={() => removeAddress(i)} />
                </View>
              ))}
              <TouchableOpacity style={styles.routeBtn} onPress={() => onStartRoute(addresses)}>
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
  subtitle: { fontSize: 14, color: '#64748B', marginBottom: 16 },

  statusBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 14 },
  statusProcessing: { backgroundColor: '#2563EB' },
  statusSuccess: { backgroundColor: '#16A34A' },
  statusText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  countLabel: { fontSize: 13, color: '#64748B', fontWeight: '600', marginRight: 4 },
  countBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  countBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  countBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  countBtnTextActive: { color: '#fff' },
  countHint: { fontSize: 12, color: '#2563EB', marginBottom: 12, lineHeight: 16 },

  previewBox: {
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 12, height: 420,
  },
  preview: { width: '100%', height: '100%' },
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewActions: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', gap: 8,
  },
  previewBtn: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14,
  },
  previewBtnGreen: { backgroundColor: 'rgba(22,163,74,0.85)' },
  previewBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  buttonGroup: { gap: 10, marginBottom: 20 },
  dimmed: { opacity: 0.5 },
  primaryBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: '#F0F7FF', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  secondaryBtnText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },

  debugBox: {
    backgroundColor: '#FFF7ED', borderRadius: 10,
    borderWidth: 1, borderColor: '#FED7AA',
    padding: 12, marginBottom: 16, gap: 4,
  },
  debugLabel: { fontSize: 12, fontWeight: '700', color: '#C2410C', marginBottom: 4 },
  debugText: { fontSize: 11, color: '#7C2D12', fontFamily: 'monospace' },

  queueSection: { marginTop: 4 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  queueTitle: { fontSize: 17, fontWeight: '700', color: '#1E3A5F' },
  queueBadge: { backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  queueBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyQueue: {
    borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
    borderStyle: 'dashed', padding: 24, alignItems: 'center',
  },
  emptyQueueText: { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  newTag: { fontSize: 11, fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  routeBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  routeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
