import express, { Request } from 'express';
import http from 'http';
import { config } from './config.js';
import { WebSocketHub } from './services/ws-hub.js';
import { SimulatorAdapter } from './adapters/ring-simulator-adapter.js';
import { createRingWebhookRouter } from './routes/ring-webhook.js';
import { AlertPayload } from '../shared/types.js';

const app = express();
const server = http.createServer(app);

// Capture raw body for HMAC verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

// Initialize Real-Time Hub
const wsHub = new WebSocketHub();
wsHub.attach(server);

// Initialize Ring Adapter (SimulatorAdapter for emulator mode)
const serverBaseUrl = `http://localhost:${config.port}`;
const simulatorAdapter = new SimulatorAdapter(serverBaseUrl, config.ringWebhookSecret);
const ringAdapter = simulatorAdapter; // Default emulator adapter

// Register Ring Webhook receiver with HMAC verification & immediate 200
app.use(
  '/webhooks/ring',
  createRingWebhookRouter({
    secret: config.ringWebhookSecret,
    onValidEvent: async (payload) => {
      // 1. Immediately broadcast Phase 1 visual alert to resident UI
      const alertPayload: AlertPayload = {
        eventId: payload.data.id,
        phase: 'PHASE_1_IMMEDIATE',
        timestamp: new Date(payload.data.attributes.timestamp || Date.now()).toISOString(),
        title: 'Visitor Alert',
        body: 'Someone is at your door',
        timeoutFallback: false,
      };

      wsHub.broadcastPhase1Alert(alertPayload);

      // 2. Emit normalized event to adapter listeners
      if (simulatorAdapter) {
        await simulatorAdapter.emitVisitorEvent(payload);
      }
    },
  })
);

// Protected local simulator trigger endpoint
app.post('/api/simulator/trigger', async (req, res) => {
  const authHeader = req.headers['x-internal-secret'] || req.headers.authorization;
  const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';

  if (!isLocal && authHeader !== config.internalDevSecret) {
    res.status(403).json({ error: 'Forbidden: internal simulator endpoint is protected' });
    return;
  }

  try {
    const result = await simulatorAdapter.triggerDoorbellPress({
      deviceId: req.body?.deviceId,
      requestId: req.body?.requestId,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger simulated event', details: String(err) });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: config.ringMode,
    timestamp: new Date().toISOString(),
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    console.log(
      `SignalDoor server running on http://localhost:${config.port} (mode: ${config.ringMode})`
    );
  });
}

export { app, server, wsHub, ringAdapter, simulatorAdapter };
