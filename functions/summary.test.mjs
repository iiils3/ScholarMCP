import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:1/test';
process.env.NEON_AUTH_JWKS_URL = 'https://example.test/auth/.well-known/jwks.json';
process.env.NEON_AUTH_BASE_URL = 'https://example.test/auth';
process.env.ALLOWED_ORIGIN = 'https://scholarmcp.mismar.me';
delete process.env.PILOT_ENABLED;
const { default: handler } = await import('./summary.mjs');

test('deployed pilot stays closed without the enable flag', async () => {
  const health = await handler.fetch(new Request('https://pilot.test/health'));
  assert.deepEqual(await health.json(), { ok: true, pilotEnabled: false });
  const request = await handler.fetch(new Request('https://pilot.test/api/v1/wallet'));
  assert.equal(request.status, 503);
  assert.equal((await request.json()).error, 'pilot_disabled');
});

test('cross-site request is rejected before any database operation', async () => {
  const request = await handler.fetch(new Request('https://pilot.test/api/v1/wallet', { headers: { Origin: 'https://other.test' } }));
  assert.equal(request.status, 403);
  assert.equal((await request.json()).error, 'origin_forbidden');
});
