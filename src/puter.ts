// Compatibility bridge kept so older imports remain stable.
// ScholarMCP now performs AI and OCR inside the browser with open-source models.
export { smartTask, localAIStatus, resetLocalAI, disposeLocalAI } from './local-ai';
export { ocrSource, structuredOCR, handwrittenOCR, ocrCapabilities, disposeOCR } from './local-ocr';
export function aiAvailable(){return true}
