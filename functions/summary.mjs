import { createRemoteJWKSet, jwtVerify } from 'jose';
import postgres from 'postgres';
import { ApiError, MAX_BODY_BYTES, SUMMARY_CREDITS, validateSummary } from '../server/summary-core.mjs';
import { createSummaryService } from '../server/summary-service.mjs';

// Neon injects the database and Auth URLs from the branch this function runs on.
const required = ['DATABASE_URL', 'NEON_AUTH_JWKS_URL', 'NEON_AUTH_BASE_URL', 'ALLOWED_ORIGIN'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);
const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL).origin;
const origin = process.env.ALLOWED_ORIGIN;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL');
const dailyLimit = Number(process.env.DAILY_SUMMARY_LIMIT || 50);
const studentDailyLimit = Number(process.env.STUDENT_DAILY_SUMMARY_LIMIT || 3);
if (![dailyLimit, studentDailyLimit].every(n => Number.isSafeInteger(n) && n > 0 && n <= 10000))
  throw new Error('Invalid summary daily limits');
const db = postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20 });
const service = createSummaryService({ db, model, dailyLimit, studentDailyLimit, apiKey: process.env.GEMINI_API_KEY });
let nextSweep = 0;

function json(status, value) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store', 'access-control-allow-origin': origin, vary: 'Origin' } });
}

async function body(request) {
  const length = Number(request.headers.get('content-length'));
  if (length > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', 'Request is too large');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_json', 'Invalid JSON');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', 'Request is too large');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); }
  catch { throw new ApiError(400, 'invalid_json', 'Invalid JSON'); }
}

async function identity(request) {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) throw new ApiError(401, 'unauthorized', 'Sign in is required');
  try {
    const { payload } = await jwtVerify(match[1], jwks, { issuer, audience: issuer, algorithms: ['EdDSA'] });
    if (!payload.sub) throw new Error('Missing subject');
    return payload.sub;
  } catch { throw new ApiError(401, 'unauthorized', 'Invalid session'); }
}

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
    if (path === '/health' && request.method === 'GET') return json(200, { ok: true, pilotEnabled: process.env.PILOT_ENABLED === 'true' });
    const requestOrigin = request.headers.get('origin');
    if (requestOrigin && requestOrigin !== origin) return json(403, { error: 'origin_forbidden' });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', vary: 'Origin' } });
    }
    try {
      if (process.env.PILOT_ENABLED !== 'true') throw new ApiError(503, 'pilot_disabled', 'Pilot is not open');
      if (!['/api/v1/onboard', '/api/v1/courses', '/api/v1/materials/text', '/api/v1/summaries', '/api/v1/wallet'].includes(path)) throw new ApiError(404, 'not_found', 'Endpoint not found');
      if (request.method !== 'POST' && !(path === '/api/v1/wallet' && request.method === 'GET')) throw new ApiError(405, 'method_not_allowed', 'Method not allowed');
      if (request.method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || ''))
        throw new ApiError(415, 'unsupported_media_type', 'Send JSON');
      const subject = await identity(request);
      if (Date.now() >= nextSweep) {
        nextSweep = Date.now() + 60000;
        await service.recoverStaleJobs();
      }
      if (path === '/api/v1/onboard') return json(200, await service.onboard(subject, await body(request)));
      const user = await service.userId(subject);
      if (path === '/api/v1/wallet') {
        const rows = await db`select monthly_balance, topup_balance, plan_code from credit_wallets where user_id = ${user}`;
        return json(200, rows[0]);
      }
      const input = await body(request);
      if (path === '/api/v1/courses') return json(201, await service.addCourse(user, input));
      if (path === '/api/v1/materials/text') return json(201, await service.addMaterial(user, input));
      const reservation = await service.reserve(user, validateSummary(input));
      if (reservation.existing) return json(200, { jobId: reservation.existing.id, status: reservation.existing.status, artifactId: reservation.existing.result_artifact_id, summary: reservation.existing.summary });
      let result;
      let artifactId;
      try {
        result = await service.generate(reservation.material);
        artifactId = await service.complete(user, reservation.jobId, reservation.material, result);
      } catch (error) {
        console.error('Summary failed', { jobId: reservation.jobId, error });
        await service.refund(user, reservation.jobId);
        throw new ApiError(502, 'provider_failed', 'Summary could not be generated; credits refunded');
      }
      return json(201, { jobId: reservation.jobId, status: 'completed', artifactId, summary: result.summary, creditsCharged: SUMMARY_CREDITS });
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('API request failed', error);
      return json(error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.code : 'server_error', message: error instanceof ApiError ? error.message : 'Request failed' });
    }
  },
};
