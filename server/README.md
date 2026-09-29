# Cloud summary foundation

This is a **backend prototype**, separate from GitHub Pages. The optional `/cloud` pilot UI is isolated from the existing student app and stays disabled without `VITE_API_BASE_URL` and `VITE_CLERK_PUBLISHABLE_KEY`. Do not publish it until an OIDC identity provider, HTTPS server host, Neon database, secret storage, data retention policy and student consent flow are configured and tested.

## Setup

1. Apply `database/neon/0001_schema.sql`, `0002_student_os.sql`, then `0003_cloud_summary.sql` to a dedicated ScholarMCP Neon database.
2. Configure the server-only variables in `.env.example` through the host's secret manager. The JWT issuer must publish an HTTPS JWKS endpoint and issue tokens with the configured audience. For the pilot UI, create a Clerk JWT template named `scholar-api` with an audience matching `AUTH_AUDIENCE` and obtain its publishable key. Verify its issuer and JWKS URL from that application. Never expose `DATABASE_URL` or `GEMINI_API_KEY` to Vite or GitHub Pages.
3. Run `npm run server` under HTTPS at a separate API host. `ALLOWED_ORIGIN` is the exact frontend origin. Configure a gateway request rate limit and a spending cap before public access.
4. Grant a small measured pilot credit allocation separately in the database. Onboarding creates a wallet with **zero** credits; it does not promise a free quota before cost measurements.

## First flow

All calls except `/health` require `Authorization: Bearer <OIDC access token>`. POST requests use JSON. `POST /api/v1/onboard` accepts `{ "name": "...", "major": "..." }`; `POST /api/v1/courses` accepts `{ "name": "..." }`; `POST /api/v1/materials/text` accepts `{ "courseId": "uuid", "name": "...", "text": "..." }` with 100–30000 characters of extracted lecture text. `POST /api/v1/summaries` accepts `{ "materialId": "uuid", "idempotencyKey": "unique_request_123", "sourceConsent": true }`. Consent to send the lecture text to the model provider is recorded with the job. `GET /api/v1/wallet` returns the balance.

Each summary reserves one pilot credit atomically, writes a ledger entry, and refunds it if generation fails. A background sweep refunds jobs still running after five minutes following a crash. Reusing the same idempotency key returns the existing job; use a new key to retry a failed job. The output is saved with `unverified` status because provider text has not passed a source citation audit. Provider token usage is logged for cost measurement. The defaults limit the whole platform to 50 summaries and each student to 3 summaries per rolling 24 hours, configurable downward before launch. This version supports extracted **text only**; PDF/image upload, OCR, file storage, and actual usage-based pricing are separate follow-up work. Before production, test crash recovery and provider billing behaviour on a dedicated Neon branch.

The currently published frontend continues to use local engines. Do not claim cloud processing is active based on this backend prototype.
