import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

// Free tier: ocr.space — get your own free key at ocr.space/OCRAPI
const OCR_API_KEY = 'K83681280088957';

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 2000 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function runOCR(imageUri: string): Promise<string> {
  // Compress before sending — free tier has a 1MB limit
  const compressed = await compressImage(imageUri);

  const formData = new FormData();

  if (Platform.OS === 'web') {
    // On web the picker returns a blob URL — fetch it and send the actual blob
    const res = await fetch(compressed);
    const blob = await res.blob();
    formData.append('file', blob, 'receipt.jpg');
  } else {
    // On native (iOS/Android) send the file URI directly
    formData.append('file', {
      uri: compressed,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    } as unknown as Blob);
  }

  formData.append('apikey', OCR_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2');  // engine 2 handles dense/small text better
  formData.append('scale', 'true');   // upscale image before processing

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.IsErroredOnProcessing) {
    throw new Error(data.ErrorMessage?.[0] ?? 'OCR processing failed');
  }

  return data.ParsedResults?.[0]?.ParsedText ?? '';
}
