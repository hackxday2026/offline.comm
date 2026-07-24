// server.js
// Offline backend: bridges the USB-serial gateway ESP32 to a simple React UI.
// No internet connection or external database is used anywhere in this file.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';

import { saveMessage, getMessages, getNodes, clearHistory } from './db.js';
import { startSerialBridge } from './serial.js';

const HTTP_PORT = process.env.HTTP_PORT || 4000;
const SERIAL_PATH = process.env.SERIAL_PORT || '/dev/ttyUSB0';
const BAUD_RATE = Number(process.env.BAUD_RATE || 115200);
const MOCK_MODE = String(process.env.MOCK_MODE || 'false').toLowerCase() === 'true';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(data);
  });
}

// --- Serial bridge: everything the gateway ESP32 sends us gets saved + pushed live ---
let bridge;
try {
  bridge = startSerialBridge({
    path: SERIAL_PATH,
    baudRate: BAUD_RATE,
    mock: MOCK_MODE,
    onMessage: async (parsed) => {
      const record = await saveMessage({ ...parsed, direction: 'incoming' });
      broadcast({ type: 'message', message: record });
    }
  });
} catch (err) {
  console.error('[server] Could not start serial bridge. Set MOCK_MODE=true in .env to keep developing without hardware.');
  process.exit(1);
}

// --- REST API ---

// Message history, optionally filtered by org and/or a specific node id
app.get('/api/messages', async (req, res) => {
  const { org, node } = req.query;
  const messages = await getMessages({ org, node });
  res.json(messages);
});

// Known nodes (who we've seen send or receive), optionally filtered by org
app.get('/api/nodes', async (req, res) => {
  const { org } = req.query;
  const nodes = await getNodes({ org });
  res.json(nodes);
});

// Send an outgoing message: writes it to the serial gateway so it goes out over NRF24L01,
// and also saves + broadcasts it immediately so the sender's own UI shows it right away.
app.post('/api/send', async (req, res) => {
  const { to, org, text, from } = req.body;
  if (!text || !to) {
    return res.status(400).json({ error: 'Both "to" and "text" are required.' });
  }

  bridge.send({ to, org: org || 'default', text });

  const record = await saveMessage({
    from: from || 'ME',
    to,
    org: org || 'default',
    text,
    direction: 'outgoing'
  });
  broadcast({ type: 'message', message: record });

  res.json({ ok: true, message: record });
});

// Wipe local history (useful while prototyping)
app.delete('/api/history', async (_req, res) => {
  await clearHistory();
  broadcast({ type: 'history_cleared' });
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mockMode: MOCK_MODE, serialPath: SERIAL_PATH });
});

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  ws.on('close', () => console.log('[ws] client disconnected'));
});

server.listen(HTTP_PORT, () => {
  console.log(`[server] HTTP + WebSocket listening on http://localhost:${HTTP_PORT}`);
  console.log(`[server] Mode: ${MOCK_MODE ? 'MOCK (no hardware)' : `LIVE (serial: ${SERIAL_PATH} @ ${BAUD_RATE})`}`);
});
