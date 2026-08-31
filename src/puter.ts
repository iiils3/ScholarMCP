// Compatibility bridge kept so older imports remain stable.
// ScholarMCP now performs AI and OCR inside the browser with open-source models.
export { smartTask, localAIStatus, resetLocalAI } from './local-ai';
export { ocrSource, structuredOCR, handwrittenOCR, ocrCapabilities } from './local-ocr';

export function aiAvailable(){return true}
