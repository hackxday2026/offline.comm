import { useState } from 'react';

export default function Composer({ target, onSend, disabled }) {
  const [text, setText] = useState('');

  function submit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || target === 'ALL') return;
    onSend(trimmed);
    setText('');
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        placeholder={
          target === 'ALL'
            ? 'Select a node on the left to send a message'
            : `Message ${target}...`
        }
        value={text}
        disabled={disabled || target === 'ALL'}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" disabled={disabled || target === 'ALL' || !text.trim()}>
        Send
      </button>
    </form>
  );
}
