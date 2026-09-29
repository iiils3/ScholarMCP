import { createServer } from 'node:http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import postgres from 'postgres';
import { ApiError, MAX_BODY_BYTES, SUMMARY_CREDITS, validateMaterial, validateSummary, summaryPrompt } from './summary-core.mjs';

const required = ['DATABASE_URL', 'AUTH_JWKS_URL', 'AUTH_ISSUER', 'AUTH_AUDIENCE', 'GEMINI_API_KEY', 'ALLOWED_ORIGIN'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}`);
const jwksUrl = new URL(process.env.AUTH_JWKS_URL);
if (jwksUrl.protocol !== 'https:') throw new Error('AUTH_JWKS_URL must use HTTPS');
const jwks = createRemoteJWKSet(jwksUrl);
const db = postgres(process.env.DATABASE_URL, { max: 5, idle_timeout: 20 });
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
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
    const { payload } = await jwtVerify(match[1], jwks, { issuer: process.env.AUTH_ISSUER, audience: process.env.AUTH_AUDIENCE, algorithms: ['RS256', 'ES256'] });
    if (!payload.sub) throw new Error('Missing subject');
    return payload.sub;
  } catch { throw new ApiError(401, 'unauthorized', 'Invalid session'); }
}

async function userId(subject) {
  const rows = await db`select id from app_users where auth_subject = ${subject}`;
  if (!rows.length) throw new ApiError(403, 'not_provisioned', 'Student account is not provisioned');
  return rows[0].id;
}

async function onboard(subject, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100 ||
      (input.major !== undefined && (typeof input.major !== 'string' || input.major.length > 100))) {
    throw new ApiError(400, 'invalid_profile', 'A name of 1–100 characters is required');
  }
  return db.begin(async tx => {
    const users = await tx`insert into app_users (auth_subject, display_name, major, onboarding_complete)
      values (${subject}, ${input.name.trim()}, ${input.major?.trim() || null}, true)
      on conflict (auth_subject) do update set display_name = excluded.display_name, major = excluded.major, updated_at = now()
      returning id, display_name, major`;
    await tx`insert into credit_wallets (user_id, monthly_balance)
      values (${users[0].id}, 0) on conflict (user_id) do nothing`;
    return users[0];
  });
}

async function addCourse(user, input) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 160)
    throw new ApiError(400, 'invalid_course', 'Course name must be 1–160 characters');
  const [{ count }] = await db`select count(*)::int as count from courses where user_id = ${user}`;
  if (count >= 50) throw new ApiError(429, 'course_limit', 'Course limit reached');
  const rows = await db`insert into courses (user_id, name) values (${user}, ${input.name.trim()}) returning id, name`;
  return rows[0];
}

async function addMaterial(user, input) {
  const { courseId, name, text } = validateMaterial(input);
  const [{ count }] = await db`select count(*)::int as count from materials where user_id = ${user}`;
  if (count >= 100) throw new ApiError(429, 'material_limit', 'Material limit reached');
  const rows = await db`
    insert into materials (user_id, course_id, name, mime_type, extension, size_bytes, page_count, parse_status, extracted_text, extracted_chars)
    select ${user}, c.id, ${name}, 'text/plain', 'txt', ${Buffer.byteLength(text)}, 1, 'ready', ${text}, ${text.length}
    from courses c where c.id = ${courseId} and c.user_id = ${user}
    returning id, course_id, name, extracted_chars`;
  if (!rows.length) throw new ApiError(404, 'course_not_found', 'Course not found');
  return rows[0];
}

async function reserve(user, { materialId, idempotencyKey }) {
  return db.begin(async tx => {
    const material = await tx`select id, course_id, name, extracted_text from materials where id = ${materialId} and user_id = ${user} and parse_status = 'ready'`;
    if (!material.length || !material[0].extracted_text) throw new ApiError(404, 'material_not_found', 'Material not found');
    const jobs = await tx`
      insert into ai_jobs (user_id, course_id, material_id, kind, status, estimated_credits, idempotency_key, source_consent_at, started_at)
      values (${user}, ${material[0].course_id}, ${materialId}, 'summary', 'running', ${SUMMARY_CREDITS}, ${idempotencyKey}, now(), now())
      on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing
      returning id`;
    if (!jobs.length) {
      const existing = await tx`
        select j.id, j.material_id, j.status, j.result_artifact_id, a.data->>'summary' as summary
        from ai_jobs j left join artifacts a on a.id = j.result_artifact_id and a.user_id = ${user}
        where j.user_id = ${user} and j.idempotency_key = ${idempotencyKey}`;
      if (existing[0].material_id !== materialId) throw new ApiError(409, 'key_reused', 'Request key belongs to another material');
      return { existing: existing[0] };
    }
    // Serialize quota checks across server instances before committing any provider work.
    await tx`select pg_advisory_xact_lock(612533987654::bigint)`;
    const [{ global_count, student_count }] = await tx`
      select count(*)::int as global_count,
        count(*) filter (where user_id = ${user})::int as student_count
      from ai_jobs where kind = 'summary' and idempotency_key is not null
        and queued_at >= now() - interval '24 hours'`;
    if (global_count > dailyLimit || student_count > studentDailyLimit)
      throw new ApiError(429, 'daily_limit', 'Summary quota reached; try later');
    const wallets = await tx`
      update credit_wallets set monthly_balance = monthly_balance - ${SUMMARY_CREDITS}, updated_at = now()
      where user_id = ${user} and monthly_balance >= ${SUMMARY_CREDITS}
      returning id`;
    if (!wallets.length) throw new ApiError(402, 'insufficient_credits', 'Insufficient credits');
    await tx`insert into credit_ledger (user_id, wallet_id, direction, bucket, amount, operation, job_id, idempotency_key)
      values (${user}, ${wallets[0].id}, 'debit', 'monthly', ${SUMMARY_CREDITS}, 'summary.reserve', ${jobs[0].id}, ${`reserve:${jobs[0].id}`})`;
    return { jobId: jobs[0].id, material: material[0] };
  });
}

async function generate(material) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, signal: controller.signal,
      body: JSON.stringify({ contents: [{ parts: [{ text: summaryPrompt(material) }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.2 } }),
    });
    if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!output) throw new Error('Empty provider response');
    return {
      summary: output.slice(0, 20000),
      inputTokens: Number(data.usageMetadata?.promptTokenCount) || null,
      outputTokens: Number(data.usageMetadata?.candidatesTokenCount) || null,
    };
  } finally { clearTimeout(timeout); }
}

async function complete(user, jobId, material, result) {
  return db.begin(async tx => {
    const artifact = await tx`
      insert into artifacts (user_id, course_id, material_id, type, title, truth_status, data)
      values (${user}, ${material.course_id}, ${material.id}, 'summary', ${`ملخص ${material.name}`}, 'unverified', ${tx.json({ summary: result.summary, source: material.name })})
      returning id`;
    await tx`update ai_jobs set status = 'completed', charged_credits = ${SUMMARY_CREDITS}, result_artifact_id = ${artifact[0].id},
      provider_name = 'gemini', model_code = ${model}, input_tokens = ${result.inputTokens}, output_tokens = ${result.outputTokens}, finished_at = now()
      where id = ${jobId} and user_id = ${user}`;
    return artifact[0].id;
  });
}

async function refund(user, jobId) {
  await db.begin(async tx => {
    const job = await tx`update ai_jobs set status = 'failed', error = 'Provider request failed', finished_at = now()
      where id = ${jobId} and user_id = ${user} and status = 'running' returning id`;
    if (!job.length) return;
    const wallet = await tx`update credit_wallets set monthly_balance = monthly_balance + ${SUMMARY_CREDITS}, updated_at = now()
      where user_id = ${user} returning id`;
    await tx`insert into credit_ledger (user_id, wallet_id, direction, bucket, amount, operation, job_id, idempotency_key)
      values (${user}, ${wallet[0].id}, 'credit', 'monthly', ${SUMMARY_CREDITS}, 'summary.refund', ${jobId}, ${`refund:${jobId}`})`;
  });
}

async function recoverStaleJobs() {
  const stale = await db`select id, user_id from ai_jobs
    where kind = 'summary' and idempotency_key is not null and status = 'running'
      and started_at < now() - interval '5 minutes' limit 100`;
  for (const job of stale) {
    try { await refund(job.user_id, job.id); }
    catch (error) { console.error('Could not refund stale summary job', { jobId: job.id, error }); }
  }
}

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
