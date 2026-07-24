import { useEffect, useState, useCallback } from 'react';
import IdentityGate, { loadIdentity } from './components/IdentityGate.jsx';
import NodeList from './components/NodeList.jsx';
import MessageStream from './components/MessageStream.jsx';
import Composer from './components/Composer.jsx';
import { fetchMessages, fetchNodes, sendMessage, connectLiveFeed, clearHistory } from './api.js';

export default function App() {
  const [identity, setIdentity] = useState(() => loadIdentity());
  const [nodes, setNodes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState('ALL');
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async (org) => {
    const [msgs, nodeList] = await Promise.all([
      fetchMessages({ org }),
      fetchNodes({ org })
    ]);
    setMessages(msgs);
    setNodes(nodeList);
  }, []);

  useEffect(() => {
    if (!identity) return;
    refresh(identity.org);

    const cleanup = connectLiveFeed((event) => {
      if (event.type === 'connection') {
        setConnected(event.status === 'connected');
      } else if (event.type === 'message') {
        if (event.message.org !== identity.org) return;
        setMessages((prev) => [...prev, event.message]);
        setNodes((prev) => {
          const others = prev.filter((n) => n.id !== event.message.from);
          return [...others, { id: event.message.from, org: event.message.org, lastSeen: event.message.timestamp }];
        });
      } else if (event.type === 'history_cleared') {
        setMessages([]);
        setNodes([]);
      }
    });

    return cleanup;
  }, [identity, refresh]);

  if (!identity) {
    return <IdentityGate onReady={setIdentity} />;
  }

  const visibleMessages =
    selected === 'ALL'
      ? messages
      : messages.filter((m) => m.from === selected || m.to === selected);

  async function handleSend(text) {
    await sendMessage({ from: identity.nodeId, to: selected, org: identity.org, text });
  }

  async function handleClear() {
    if (confirm('Clear all local message history for this organization?')) {
      await clearHistory();
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <span className="brand">Mesh Link</span>
          <span className="org-tag">{identity.org}</span>
        </div>
        <div className="header-right">
          <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span className="status-label">{connected ? 'Live' : 'Reconnecting...'}</span>
          <span className="self-tag">{identity.nodeId}</span>
          <button className="link-button" onClick={handleClear}>Clear history</button>
        </div>
      </header>

      <div className="app-body">
        <NodeList nodes={nodes} selected={selected} onSelect={setSelected} self={identity.nodeId} />
        <main className="chat-pane">
          <MessageStream messages={visibleMessages} self={identity.nodeId} />
          <Composer target={selected} onSend={handleSend} disabled={!connected} />
        </main>
      </div>
    </div>
  );
}
