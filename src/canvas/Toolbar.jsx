import React from 'react';
import { useStore } from '../core/store.js';
import { listTools } from '../core/registry.js';

// Top toolbar. Auto-builds a button for every registered tool.
export function Toolbar() {
  const activeToolId = useStore((s) => s.activeToolId);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const tools = listTools();

  return (
    <div id="toolbar">
      <h1>✨ Magical Thread</h1>
      {tools.map((t) => (
        <button
          key={t.id}
          className={activeToolId === t.id ? 'active' : ''}
          onClick={() => setActiveTool(activeToolId === t.id ? null : t.id)}
        >
          {t.label}
        </button>
      ))}
      <span className="spacer" />
      <span className="hint">拖入 CSV 文件 · 选工具后在画布上操作</span>
    </div>
  );
}
