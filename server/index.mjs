import { createServer } from 'node:http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import postgres from 'postgres';
import { ApiError, MAX_BODY_BYTES, SUMMARY_CREDITS, validateSummary } from './summary-core.mjs';
import { createSummaryService } from './summary-service.mjs';

const required = ['DATABASE_URL', 'AUTH_JWKS_URL', 'AUTH_ISSUER', 'AUTH_AUDIENCE', 'GEMINI_API_KEY', 'ALLOWED_ORIGIN'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);
const jwksUrl = new URL(process.env.AUTH_JWKS_URL);
if (jwksUrl.protocol !== 'https:') throw new Error('AUTH_JWKS_URL must use HTTPS');
const jwks = createRemoteJWKSet(jwksUrl);
const db = postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20 });
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL');
const dailyLimit = Number(process.env.DAILY_SUMMARY_LIMIT || 50);
const studentDailyLimit = Number(process.env.STUDENT_DAILY_SUMMARY_LIMIT || 3);
if (![dailyLimit, studentDailyLimit].every(n => Number.isSafeInteger(n) && n > 0 && n <= 10000))
  throw new Error('Invalid summary daily limits');

function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': allowedOrigin, 'vary': 'Origin' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ApiError(413, 'body_too_large', 'Request is too large');
  }
  try { return JSON.parse(raw); } catch { throw new ApiError(400, 'invalid_json', 'Invalid JSON'); }
}

async function identity(req) {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
  if (!match) throw new ApiError(401, 'unauthorized', 'Sign in is required');
  try {
    const { payload } = await jwtVerify(match[1], jwks, { issuer: process.env.AUTH_ISSUER, audience: process.env.AUTH_AUDIENCE, algorithms: ['EdDSA'] });
    if (!payload.sub) throw new Error('Missing subject');
    return payload.sub;
  } catch { throw new ApiError(401, 'unauthorized', 'Invalid session'); }
}

const { userId, onboard, addCourse, addMaterial, reserve, generate, complete, refund, recoverStaleJobs } = createSummaryService({ db, model, dailyLimit, studentDailyLimit, apiKey: process.env.GEMINI_API_KEY });

const server = createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') return send(res, 200, { ok: true });
  if (req.headers.origin && req.headers.origin !== allowedOrigin) return send(res, 403, { error: 'origin_forbidden' });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': allowedOrigin, 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'vary': 'Origin' });
    return res.end();
  }
  try {
    if (!['/api/v1/onboard', '/api/v1/courses', '/api/v1/materials/text', '/api/v1/summaries', '/api/v1/wallet'].includes(req.url)) throw new ApiError(404, 'not_found', 'Endpoint not found');
    if (req.method !== 'POST' && !(req.url === '/api/v1/wallet' && req.method === 'GET')) throw new ApiError(405, 'method_not_allowed', 'Method not allowed');
    if (req.method === 'POST' && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || ''))
      throw new ApiError(415, 'unsupported_media_type', 'Send JSON');
    const subject = await identity(req);
    if (req.url === '/api/v1/onboard') return send(res, 200, await onboard(subject, await body(req)));
    const user = await userId(subject);
    if (req.url === '/api/v1/wallet') {
      const rows = await db`select monthly_balance, topup_balance, plan_code from credit_wallets where user_id = ${user}`;
      return send(res, 200, rows[0]);
    }
    const input = await body(req);
    if (req.url === '/api/v1/courses') return send(res, 201, await addCourse(user, input));
    if (req.url === '/api/v1/materials/text') return send(res, 201, await addMaterial(user, input));
    const reservation = await reserve(user, validateSummary(input));
    if (reservation.existing) return send(res, 200, { jobId: reservation.existing.id, status: reservation.existing.status, artifactId: reservation.existing.result_artifact_id, summary: reservation.existing.summary });
    let result;
    let artifactId;
    try {
      result = await generate(reservation.material);
      artifactId = await complete(user, reservation.jobId, reservation.material, result);
    } catch (error) {
      console.error('Summary failed', { jobId: reservation.jobId, error });
      await refund(user, reservation.jobId);
      throw new ApiError(502, 'provider_failed', 'Summary could not be generated; credits refunded');
    }
    return send(res, 201, { jobId: reservation.jobId, status: 'completed', artifactId, summary: result.summary, creditsCharged: SUMMARY_CREDITS });
  } catch (error) {
    if (!(error instanceof ApiError)) console.error('API request failed', error);
    return send(res, error instanceof ApiError ? error.status : 500, { error: error instanceof ApiError ? error.code : 'server_error', message: error instanceof ApiError ? error.message : 'Request failed' });
  }
});

server.listen(Number(process.env.PORT || 8787), '0.0.0.0');
recoverStaleJobs().catch(error => console.error('Stale-job recovery failed', error));
setInterval(() => recoverStaleJobs().catch(error => console.error('Stale-job recovery failed', error)), 60000).unref();
