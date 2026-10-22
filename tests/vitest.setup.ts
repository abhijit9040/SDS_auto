/**
 * Vitest global setup — B7: WebSocket test environment
 *
 * ALLOW_NO_ORIGIN=1 lets existing WebSocket tests (quick-reply,
 * two-phase-alert) connect without an Origin header. B7 tests
 * explicitly omit this flag when verifying the no-Origin rejection.
 */

// Allow WebSocket connections without an Origin header in tests.
// Individual test suites that verify Origin-rejection may override
// this before opening the socket under test.
process.env.ALLOW_NO_ORIGIN = process.env.ALLOW_NO_ORIGIN || '1';
