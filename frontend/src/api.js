// api.js
// All communication with the local backend. No internet endpoints anywhere.

const BASE_URL = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000/ws';

export async function fetchMessages({ org, node } = {}) {
  const params = new URLSearchParams();
  if (org) params.set('org', org);
  if (node) params.set('node', node);
  const res = await fetch(`${BASE_URL}/api/messages?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load message history');
  return res.json();
}

export async function fetchNodes({ org } = {}) {
  const params = new URLSearchParams();
  if (org) params.set('org', org);
  const res = await fetch(`${BASE_URL}/api/nodes?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to load node list');
  return res.json();
}

export async function sendMessage({ from, to, org, text }) {
  const res = await fetch(`${BASE_URL}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, org, text })
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function clearHistory() {
  const res = await fetch(`${BASE_URL}/api/history`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear history');
  return res.json();
}

/**
 * Opens a WebSocket and reconnects automatically if the backend restarts.
 * @param {(payload: object) => void} onEvent
 * @returns {() => void} cleanup function
 */
export function connectLiveFeed(onEvent) {
  let ws;
  let closedByUser = false;
  let retryDelay = 1000;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      retryDelay = 1000;
      onEvent({ type: 'connection', status: 'connected' });
    };

    ws.onmessage = (event) => {
      try {
        onEvent(JSON.parse(event.data));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      onEvent({ type: 'connection', status: 'disconnected' });
      if (!closedByUser) {
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 1.5, 10000);
      }
    };

    ws.onerror = () => ws.close();
  }

  connect();

  return () => {
    closedByUser = true;
    ws?.close();
  };
}
