function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function NodeList({ nodes, selected, onSelect, self }) {
  return (
    <aside className="node-list">
      <div className="node-list-header">
        <span className="signal-dot" />
        Nodes on air
      </div>

      <button
        className={`node-row ${selected === 'ALL' ? 'active' : ''}`}
        onClick={() => onSelect('ALL')}
      >
        <span className="node-name">All traffic</span>
      </button>

      {nodes
        .filter((n) => n.id !== self)
        .map((n) => (
          <button
            key={n.id}
            className={`node-row ${selected === n.id ? 'active' : ''}`}
            onClick={() => onSelect(n.id)}
          >
            <span className="node-name">{n.id}</span>
            <span className="node-meta">{timeAgo(n.lastSeen)}</span>
          </button>
        ))}

      {nodes.filter((n) => n.id !== self).length === 0 && (
        <p className="node-empty">No other nodes heard yet.</p>
      )}
    </aside>
  );
}
