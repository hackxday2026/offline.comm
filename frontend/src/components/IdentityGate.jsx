import { useState } from 'react';

const STORAGE_KEY = 'mesh-link-identity';

export function loadIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveIdentity(identity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export default function IdentityGate({ onReady }) {
  const [nodeId, setNodeId] = useState('');
  const [org, setOrg] = useState('default');

  function submit(e) {
    e.preventDefault();
    const trimmedId = nodeId.trim().toUpperCase().replace(/\s+/g, '_');
    const trimmedOrg = org.trim() || 'default';
    if (!trimmedId) return;
    const identity = { nodeId: trimmedId, org: trimmedOrg };
    saveIdentity(identity);
    onReady(identity);
  }

  return (
    <div className="identity-gate">
      <form className="identity-card" onSubmit={submit}>
        <h1>Mesh Link</h1>
        <p className="identity-sub">Identify this console before joining the mesh.</p>

        <label>
          This node's ID
          <input
            autoFocus
            placeholder="e.g. NODE_A"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
          />
        </label>

        <label>
          Organization
          <input
            placeholder="e.g. warehouse-team"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          />
        </label>

        <button type="submit">Enter console</button>
        <p className="identity-note">
          Stored only in this browser. Nothing leaves your machine.
        </p>
      </form>
    </div>
  );
}
