// FEATURE: bind-data
// Drag a data-column card (from the sidebar) onto a thread to BIND that column.
// The rows are distributed along the thread by arc length, in their original
// order, and drawn as small light-grey dots. A small margin is left at the head
// and tail of the thread so that on a closed loop (circle) the first and last
// points do NOT overlap.
//
// Hovering a dot shows a tooltip with that point's TIME and VALUE (the time is
// bound directly onto each value by csv-import).
//
// Implemented as a pipeline card 'bind-data'. Disable/delete the card to unbind
// — fully non-destructive. Self-contained: no edits to existing files.

import React, { useState } from 'react';
import { registerThreadOp, buildArcLength, pointAtT } from '../../core/threadEngine.js';
import { registerThreadLayer, registerThreadDropHandler } from '../draw-thread/index.jsx';
import { useStore } from '../../core/store.js';

// Fraction of the curve left empty at each end so dots don't pile onto the
// endpoints (important for closed shapes where start == end).
const END_MARGIN = 0.04;

// Default (even) t for point k of n, inside [margin, 1 - margin].
function defaultT(k, n, margin = END_MARGIN) {
  if (n <= 1) return 0.5;
  return margin + ((1 - 2 * margin) * k) / (n - 1);
}

// Find the t (0..1) on the curve whose point is nearest to (px, py).
// Coarse sample then a local refine — cheap and accurate enough for dragging.
function nearestT(arc, px, py) {
  let bestT = 0;
  let bestD = Infinity;
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = pointAtT(arc, t);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < bestD) { bestD = d; bestT = t; }
  }
  // local refine around bestT
  const step = 1 / N;
  for (let t = bestT - step; t <= bestT + step; t += step / 20) {
    const tt = Math.max(0, Math.min(1, t));
    const p = pointAtT(arc, tt);
    const d = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d < bestD) { bestD = d; bestT = tt; }
  }
  return bestT;
}

// Place `n` points evenly by arc length within [margin, 1 - margin].
function placeAlongWithMargin(points, n, margin = END_MARGIN) {
  const arc = buildArcLength(points);
  const out = [];
  if (n <= 0) return out;
  if (n === 1) return [pointAtT(arc, 0.5)];
  const lo = margin;
  const hi = 1 - margin;
  for (let k = 0; k < n; k++) {
    const t = lo + ((hi - lo) * k) / (n - 1);
    out.push(pointAtT(arc, t));
  }
  return out;
}

// Normalize a stored value which may be the new { time, value } shape or a
// legacy plain scalar.
function normalizeValue(v, i) {
  if (v && typeof v === 'object' && 'value' in v) {
    return { time: 'time' in v ? v.time : i, value: v.value };
  }
  return { time: i, value: v };
}

// --- The pipeline card: turn a bound column into `rows` on the ThreadState ---
registerThreadOp({
  id: 'bind-data',
  label: 'Bind Data',
  apply: (state, params) => {
    const values = params.values || [];
    // rows carry a STABLE original index + value + time; order = position on thread.
    const rows = values.map((v, i) => {
      const { time, value } = normalizeValue(v, i);
      return { index: i, value, time };
    });
    return {
      ...state,
      rows,
      meta: {
        ...state.meta,
        boundColumn: params.column,
        timeColumn: params.timeColumn || 'time',
      },
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
    params: {
      column: col.data.column,
      values: col.data.values,
      timeColumn: col.data.timeColumn,
    },
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

// --- Layer: render the data points as dots. Positions come from an even
//     baseline, with per-point overrides (state.meta.pointT) from move-point.
//     Selected dots (state.selection) render BLACK. Hover shows a tooltip.
//     Clicking forwards to window.__mtOnDotClick; dragging (when Move Point is
//     active) forwards to window.__mtOnPointMove. ---
function BindDataLayer({ obj, state, points }) {
  const [hover, setHover] = useState(null); // { i, x, y }
  const rows = state.rows || [];
  if (!rows.length || !points.length) return null;

  const arc = buildArcLength(points);
  const n = rows.length;
  const overrides = state.meta?.pointT || {};
  const positions = rows.map((row, k) => {
    const t = overrides[row.index] != null ? overrides[row.index] : defaultT(k, n);
    return pointAtT(arc, t);
  });

  const valueLabel = state.meta?.boundColumn || 'value';
  const timeLabel = state.meta?.timeColumn || 'time';
  const selection = state.selection || [];

  // Begin dragging a dot along the curve (only in Move Point mode).
  function beginDrag(e, stableIndex) {
    if (!window.__mtOnPointMove || !window.__mtIsPointDragMode?.()) return;
    e.stopPropagation();
    e.preventDefault();
    const svg = document.getElementById('canvas-svg');
    const onMove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      window.__mtOnPointMove(obj, stableIndex, nearestT(arc, px, py));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <g className="bind-data-layer">
      {positions.map((p, i) => {
        const selected = selection.includes(rows[i].index);
        const hovered = hover && hover.i === i;
        const dragMode = window.__mtIsPointDragMode?.();
        let fill = '#cbd5e1';
        if (selected) fill = '#000';
        else if (hovered) fill = '#94a3b8';
        return (
          <circle
            key={rows[i].index}
            cx={p.x}
            cy={p.y}
            r={hovered ? 5 : 3.5}
            fill={fill}
            stroke={selected ? '#000' : '#94a3b8'}
            strokeWidth={0.75}
            style={{ cursor: dragMode ? 'grab' : 'pointer' }}
            onMouseEnter={() => setHover({ i, x: p.x, y: p.y })}
            onMouseLeave={() => setHover((h) => (h && h.i === i ? null : h))}
            onPointerDown={(e) => beginDrag(e, rows[i].index)}
            onClick={(e) => {
              e.stopPropagation();
              // In Move Point mode clicks are for dragging, not selection.
              if (window.__mtIsPointDragMode?.()) return;
              if (window.__mtOnDotClick) window.__mtOnDotClick(obj, rows[i].index);
            }}
          />
        );
      })}

      {hover && (() => {
        const row = rows[hover.i];
        const timeText = `${timeLabel}: ${row.time}`;
        const valText = `${valueLabel}: ${row.value}`;
        const w = Math.max(timeText.length, valText.length) * 6.5 + 16;
        const h = 38;
        const canvasEl = typeof document !== 'undefined' ? document.getElementById('canvas') : null;
        const cw = canvasEl ? canvasEl.clientWidth : 100000;
        let tx = hover.x + 10;
        if (tx + w > cw) tx = hover.x - 10 - w;
        let ty = hover.y - h - 8;
        if (ty < 4) ty = hover.y + 12;
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={tx} y={ty} width={w} height={h} rx={5}
              fill="rgba(15,23,42,0.92)" stroke="#334155" strokeWidth={0.75} />
            <text x={tx + 8} y={ty + 15} fontSize={11} fill="#e2e8f0">{timeText}</text>
            <text x={tx + 8} y={ty + 29} fontSize={11} fill="#e2e8f0">{valText}</text>
          </g>
        );
      })()}
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