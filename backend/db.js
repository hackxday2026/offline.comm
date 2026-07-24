import { JSONFilePreset } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "db.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const defaultData = {
  // every message ever seen, in order
  messages: [],
  // every unique node id we've heard from or sent to, with org + last-seen time
  nodes: {},
};

export const db = await JSONFilePreset(dbFile, defaultData);

function upsertNode(nodeId, org) {
  if (!nodeId) return;
  const existing = db.data.nodes[nodeId];
  db.data.nodes[nodeId] = {
    id: nodeId,
    org: org || existing?.org || "default",
    lastSeen: new Date().toISOString(),
  };
}

export async function saveMessage(msg) {
  // msg: { from, to, org, text, direction, timestamp }
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from: msg.from || "unknown",
    to: msg.to || "broadcast",
    org: msg.org || "default",
    text: msg.text ?? "",
    direction: msg.direction || "incoming", // incoming = received over NRF24, outgoing = sent by this UI
    timestamp: msg.timestamp || new Date().toISOString(),
  };

  upsertNode(record.from, record.org);
  if (record.to && record.to !== "broadcast") {
    upsertNode(record.to, record.org);
  }

  db.data.messages.push(record);
  await db.write();
  return record;
}

export async function getMessages({ org, node, limit = 500 } = {}) {
  let msgs = db.data.messages;
  if (org) msgs = msgs.filter((m) => m.org === org);
  if (node) msgs = msgs.filter((m) => m.from === node || m.to === node);
  return msgs.slice(-limit);
}

export async function getNodes({ org } = {}) {
  let nodes = Object.values(db.data.nodes);
  if (org) nodes = nodes.filter((n) => n.org === org);
  return nodes.sort((a, b) => (a.id > b.id ? 1 : -1));
}

export async function clearHistory() {
  db.data.messages = [];
  db.data.nodes = {};
  await db.write();
}
