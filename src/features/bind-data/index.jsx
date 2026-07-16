// FEATURE: bind-data
// Drag a data-column card (from the sidebar) onto a thread to BIND that column.
// The rows are distributed EVENLY along the thread by arc length, in their
// original order, and drawn as small light-grey dots.
//
// Implemented as a pipeline card 'bind-data' inserted after 'draw-thread'
// (and after 'shape-correct' if present). Disable/delete the card to unbind —
// fully non-destructive. Self-contained: no edits to existing files.

import React from 'react';
import { registerThreadOp, placeAlong } from '../../core/threadEngine.js';
import { registerThreadLayer, registerThreadDropHandler } from '../draw-thread/index.jsx';
import { useStore } from '../../core/store.js';

// --- The pipeline card: turn a bound column into `rows` on the ThreadState ---
registerThreadOp({
  id: 'bind-data',
  label: 'Bind Data',
  apply: (state, params) => {
    const values = params.values || [];
    // rows carry a STABLE original index + the value; order = position on thread.
    const rows = values.map((v, i) => ({ index: i, value: v }));
    return {
      ...state,
      rows,
      meta: { ...state.meta, boundColumn: params.column },
    };
  },
});

// --- Drop handler: dropping a column card onto a thread appends a bind-data card ---
registerThreadDropHandler((obj, columnId) => {
  const col = useStore.getState().getObject(columnId);
  if (!col || col.type !== 'columnCard') return false;

  const ops = obj.data.ops || [];
  const existingIdx = ops.findIndex((c) => c.opId === 'bind-data');
  const card = {
    opId: 'bind-data',
    params: { column: col.data.column, values: col.data.values },
    enabled: true,
  };

  let next;
  if (existingIdx >= 0) {
    // rebind: replace the existing bind-data card in place
    next = ops.map((c, i) => (i === existingIdx ? card : c));
  } else {
    next = [...ops, card];
  }
  useStore.getState().updateObject(obj.id, { data: { ops: next } });
  return true;
});

// --- Layer: render the evenly-distributed data points as light-grey dots ---
function BindDataLayer({ state, points }) {
  const rows = state.rows || [];
  if (!rows.length || !points.length) return null;

  const positions = placeAlong(points, rows.length);
  return (
    <g className="bind-data-layer">
      {positions.map((p, i) => (
        <circle
          key={rows[i].index}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth={0.75}
          style={{ pointerEvents: 'none' }}
        />
      ))}
    </g>
  );
}
registerThreadLayer(BindDataLayer);

// --- Card label: show which column is bound ---
const prevLabel = window.__mtCardLabel;
window.__mtCardLabel = (card) => {
  if (card.opId === 'bind-data') {
    return `bind-data → ${card.params?.column || '?'}`;
  }
  return prevLabel ? prevLabel(card) : card.opId;
};
