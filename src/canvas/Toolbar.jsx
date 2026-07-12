import React from 'react';
import { useStore } from '../core/store.js';
import { listTools } from '../core/registry.js';

// Auto-builds a button for every registered tool. Never edited when adding features.
export function Toolbar() {
  const activeToolId = useStore((s) => s.activeToolId);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const tools = listTools();

  return (
    <div style={{ display: 'flex', gap: 8, padding: 8, borderBottom: '1px solid #ddd', alignItems: 'center' }}>
      <strong style={{ marginRight: 8 }}>Magical Thread</strong>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setActiveTool(activeToolId === t.id ? null : t.id)}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: 6,
            background: activeToolId === t.id ? '#4f46e5' : '#fff',
            color: activeToolId === t.id ? '#fff' : '#333',
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
      {tools.length === 0 && <span style={{ color: '#999' }}>No tools registered yet</span>}
    </div>
  );
}
