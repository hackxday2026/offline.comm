import { useEffect, useRef } from 'react';

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function MessageStream({ messages, self }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="message-stream">
      {messages.length === 0 && (
        <div className="stream-empty">
          No transmissions yet. Send a message or wait for one to come in over NRF24L01.
        </div>
      )}

      {messages.map((m) => {
        const outgoing = m.direction === 'outgoing' || m.from === self;
        return (
          <div key={m.id} className={`msg-row ${outgoing ? 'out' : 'in'}`}>
            <div className="msg-bar" aria-hidden="true" />
            <div className="msg-body">
              <div className="msg-meta">
                <span className="msg-from">{m.from}</span>
                <span className="msg-arrow">&rarr;</span>
                <span className="msg-to">{m.to}</span>
                <span className="msg-time">{formatTime(m.timestamp)}</span>
              </div>
              <div className="msg-text">{m.text}</div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
