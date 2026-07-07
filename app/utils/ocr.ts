// Free tier: ocr.space — 25,000 requests/month. Get your own key at ocr.space/OCRAPI
const OCR_API_KEY = 'helloworld'; // demo key — replace before going to production

export async function runOCR(imageUri: string): Promise<string> {
  const formData = new FormData();

  // React Native accepts { uri, type, name } as a file in FormData
  formData.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'receipt.jpg',
  } as unknown as Blob);
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
