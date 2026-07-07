import { Platform } from 'react-native';

// Free tier: ocr.space — get your own free key at ocr.space/OCRAPI
const OCR_API_KEY = 'helloworld';

export async function runOCR(imageUri: string): Promise<string> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // On web the picker returns a blob URL — fetch it and send the actual blob
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append('file', blob, 'receipt.jpg');
  } else {
    // On native (iOS/Android) send the file URI directly
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'receipt.jpg',
    } as unknown as Blob);
  }

  formData.append('apikey', OCR_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');

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
