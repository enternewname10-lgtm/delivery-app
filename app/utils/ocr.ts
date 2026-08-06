import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const OCR_API_KEY = 'K83681280088957';
const OCR_TIMEOUT_MS = 30000;

async function callOCRAPI(formData: FormData): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OCR request failed: ${response.status}`);
    const data = await response.json();
    if (data.IsErroredOnProcessing) throw new Error(data.ErrorMessage?.[0] ?? 'OCR processing failed');
    return data.ParsedResults?.[0]?.ParsedText ?? '';
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('OCR timed out — try a clearer photo');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function buildFormData(): FormData {
  const fd = new FormData();
  fd.append('apikey', OCR_API_KEY);
  fd.append('language', 'eng');
  fd.append('isOverlayRequired', 'false');
  fd.append('OCREngine', '2');
  fd.append('scale', 'true');
  return fd;
}

async function uriToFormData(uri: string, formData: FormData) {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    formData.append('file', blob, 'receipt.jpg');
  } else {
    formData.append('file', { uri, type: 'image/jpeg', name: 'receipt.jpg' } as unknown as Blob);
  }
}

// Standard OCR — compresses image first
export async function runOCR(imageUri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(imageUri);
  ctx.resize({ width: 2000 });
  const img = await ctx.renderAsync();
  const result = await img.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  ctx.release();
  img.release();

  const formData = buildFormData();
  await uriToFormData(result.uri, formData);
  return callOCRAPI(formData);
}

// Direct OCR — send a pre-processed URI without re-compressing (used for cropped strips)
export async function runOCRDirect(processedUri: string): Promise<string> {
  const formData = buildFormData();
  await uriToFormData(processedUri, formData);
  return callOCRAPI(formData);
}
