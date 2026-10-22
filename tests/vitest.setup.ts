/**
 * Vitest global setup — B8: hermetic test environment
 *
 * Sets fixed test-only values for secrets so that `npm test` passes
 * on a clean clone with NO .env file present. These values are only
 * ever used in the test process; they never reach the real server at
 * runtime (the startup guard in config.ts still enforces real secrets
 * there).
 *
 * ALLOW_NO_ORIGIN=1 lets existing WebSocket tests (quick-reply,
 * two-phase-alert) connect without an Origin header. B7 tests
 * explicitly omit this flag when verifying the no-Origin rejection.
 */

// Fixed 64-char hex test secrets (never used in production)
process.env.RING_WEBHOOK_SECRET =
  process.env.RING_WEBHOOK_SECRET ||
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

process.env.INTERNAL_DEV_SECRET =
  process.env.INTERNAL_DEV_SECRET ||
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

// Allow WebSocket connections without an Origin header in tests.
// Individual test suites that verify Origin-rejection may override
// this before opening the socket under test.
process.env.ALLOW_NO_ORIGIN = process.env.ALLOW_NO_ORIGIN || '1';
