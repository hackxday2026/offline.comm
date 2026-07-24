// serial.js
// Talks to the "gateway" ESP32 that is plugged into this computer over USB.
// That gateway forwards messages to/from the other ESP32 nodes over NRF24L01.
//
// Expected line format coming FROM the gateway over serial (one JSON object per line):
//   {"from":"B","to":"A","org":"default","msg":"hello there"}
//
// If your current firmware just prints plain text (e.g. "Received from B: hello"),
// see parsePlainTextFallback() below — it does a best-effort parse so you can get
// started immediately, but switching the firmware to print JSON is far more robust.

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

function parsePlainTextFallback(line) {
  // Best-effort parse for a line like: "Received from B: hello there"
  const match = line.match(/from\s+([A-Za-z0-9_-]+)\s*:\s*(.*)$/i);
  if (match) {
    return { from: match[1], to: 'GATEWAY', org: 'default', text: match[2] };
  }
  return null;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const obj = JSON.parse(trimmed);
    return {
      from: obj.from,
      to: obj.to,
      org: obj.org || 'default',
      text: obj.msg ?? obj.text ?? ''
    };
  } catch {
    const fallback = parsePlainTextFallback(trimmed);
    if (fallback) return fallback;
    // Not a recognized format — surface it as a raw system line so nothing is silently dropped.
    return { from: 'GATEWAY', to: 'broadcast', org: 'default', text: trimmed, raw: true };
  }
}

/**
 * @param {object} opts
 * @param {string} opts.path - serial device path (e.g. /dev/ttyUSB0 or COM5)
 * @param {number} opts.baudRate
 * @param {boolean} opts.mock - run without real hardware, emitting fake traffic
 * @param {(msg: object) => void} opts.onMessage - called with each parsed incoming message
 */
export function startSerialBridge({ path, baudRate, mock, onMessage }) {
  if (mock) {
    console.log('[serial] MOCK_MODE enabled — generating fake ESP32 traffic, no hardware needed.');
    const fakeNodes = ['NODE_A', 'NODE_B', 'NODE_C'];
    let i = 0;
    const interval = setInterval(() => {
      const from = fakeNodes[i % fakeNodes.length];
      const to = fakeNodes[(i + 1) % fakeNodes.length];
      onMessage({ from, to, org: 'default', text: `test packet #${i}` });
      i++;
    }, 4000);
    return {
      send: (payload) => {
        console.log('[serial:mock] would send ->', payload);
        return true;
      },
      close: () => clearInterval(interval)
    };
  }

  let port;
  try {
    port = new SerialPort({ path, baudRate });
  } catch (err) {
    console.error(`[serial] Failed to open ${path}: ${err.message}`);
    console.error('[serial] Set MOCK_MODE=true in .env to develop without hardware.');
    throw err;
  }

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open', () => console.log(`[serial] Connected to gateway on ${path} @ ${baudRate} baud`));
  port.on('error', (err) => console.error('[serial] Error:', err.message));

  parser.on('data', (line) => {
    const parsed = parseLine(line);
    if (parsed) onMessage(parsed);
  });

  return {
    send: (payload) => {
      // payload: { to, org, text }
      // Sent to the gateway as one JSON line; gateway firmware reads this over
      // Serial and re-transmits it to the target node via NRF24L01.
      const line = JSON.stringify({ to: payload.to, org: payload.org, msg: payload.text }) + '\n';
      port.write(line, (err) => {
        if (err) console.error('[serial] Write failed:', err.message);
      });
      return true;
    },
    close: () => port.close()
  };
}
