export const MAX_SOURCE_CHARS = 30000;
export const MAX_BODY_BYTES = 110000;
export const SUMMARY_CREDITS = 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validateMaterial(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'invalid_body', 'Invalid JSON body');
  const courseId = input.courseId;
  const name = input.name?.trim();
  const text = input.text?.trim();
  if (typeof courseId !== 'string' || !UUID.test(courseId)) throw new ApiError(400, 'invalid_course', 'A course ID is required');
  if (typeof name !== 'string' || !name || name.length > 160) throw new ApiError(400, 'invalid_name', 'Name must be 1–160 characters');
  if (typeof text !== 'string' || text.length < 100 || text.length > MAX_SOURCE_CHARS) throw new ApiError(400, 'invalid_text', 'Text must be 100–30000 characters');
  return { courseId, name, text };
}

export function validateSummary(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'invalid_body', 'Invalid JSON body');
  if (typeof input.materialId !== 'string' || !UUID.test(input.materialId)) throw new ApiError(400, 'invalid_material', 'A material ID is required');
  if (typeof input.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{12,100}$/.test(input.idempotencyKey)) throw new ApiError(400, 'invalid_idempotency_key', 'A unique request key is required');
  if (input.sourceConsent !== true) throw new ApiError(400, 'consent_required', 'Consent to send source text to the model provider is required');
  return { materialId: input.materialId, idempotencyKey: input.idempotencyKey };
}

export function summaryPrompt(material) {
  return `Summarize the student's source in its original language. Preserve scientific terms and exam-relevant detail. Explain sections and key concepts. Never invent a fact or citation. If a part is illegible or unsupported, say so. Return plain text.\n\nSource: ${material.name}\n${material.extracted_text}`;
}
