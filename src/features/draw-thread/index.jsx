// FEATURE: draw-thread
// Adds a "draw thread" tool. Freehand-draw on the canvas -> creates a Thread object.
// A Thread stores an ORDERED list of operation cards (its pipeline). Its first card
// is this "draw-thread" op, which simply provides the geometry. Deleting that card
// removes the whole thread.
//
// The thread renderer also:
//   - exposes a wide transparent hit-area along the curve (so other features, e.g.
//     bind-data, can accept drops onto the thread), and
//   - renders any data points that upstream ops (e.g. bind-data) placed in
//     state.rows via a pluggable list of "thread layers".

import React, { useState } from 'react';
import { line, curveCatmullRom } from 'd3-shape';
import { registerTool, registerRenderer } from '../../core/registry.js';
import { useStore } from '../../core/store.js';
import { makeObject } from '../../core/types.js';
import { registerThreadOp, runPipeline } from '../../core/threadEngine.js';

// --- path generator (smooth curve through the sampled points) ---
const pathGen = line().x((d) => d.x).y((d) => d.y).curve(curveCatmullRom.alpha(0.5));
export function pointsToPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y}`;
  }
  return pathGen(points);
}

// --- Pluggable thread layers -------------------------------------------------
// A feature can draw extra things on top of a thread (data points, anchors, etc.)
// by registering a layer here. Each layer is a React component that receives
// { obj, state, points }. This keeps draw-thread from needing to know about
// bind-data or any future feature.
const threadLayers = [];
export function registerThreadLayer(Component) {
  threadLayers.push(Component);
}

// A feature can also install a drop handler for when a data column is dropped
// onto a thread. Signature: (obj, columnId) => void. First one that handles wins.
const threadDropHandlers = [];
export function registerThreadDropHandler(fn) {
  threadDropHandlers.push(fn);
}

// --- 1. The thread-op: the first card in every thread's pipeline ---
registerThreadOp({
  id: 'draw-thread',
  label: 'Draw Thread',
  apply: (state, params) => ({
    ...state,
    geometry: { points: params.points || [] },
  }),
});

// --- 2. The drawing tool ---
let drawing = false;
let pts = [];

registerTool({
  id: 'draw-thread',
  label: '✏️ Draw Thread',
  onPointerDown: (pt) => {
    drawing = true;
    pts = [pt];
    useStore.getState().setDrawPreview([...pts]);
  },
  onPointerMove: (pt) => {
    if (!drawing) return;
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 3) {
      pts.push(pt);
      useStore.getState().setDrawPreview([...pts]);
    }
  },
  onPointerUp: () => {
    if (!drawing) return;
    drawing = false;
    if (pts.length >= 2) {
      const obj = makeObject('thread', {
        ops: [{ opId: 'draw-thread', params: { points: pts }, enabled: true }],
        panelOpen: false,
      });
      useStore.getState().addObject(obj);
    }
    pts = [];
    useStore.getState().setDrawPreview(null);
  },
});

// --- 3. Live dashed preview while drawing ---
function DrawPreview() {
  const preview = useStore((s) => s.drawPreview);
  if (!preview || preview.length < 2) return null;
  return <path className="thread-stroke-preview" d={pointsToPath(preview)} />;
}
registerRenderer({ type: '__drawPreview', render: () => <DrawPreview /> });

// A card may provide a nicer label (e.g. "shape-correct → Circle") by installing
// window.__mtCardLabel. If absent, we just show the opId.
function cardLabel(card) {
  const fn = window.__mtCardLabel;
  return (fn && fn(card)) || card.opId;
}

// --- 4. Renderer for a Thread object ---
const PANEL_W = 220;
const PANEL_H = 400;

function ThreadView({ obj }) {
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const [, force] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const ops = obj.data.ops || [];
  const state = runPipeline(ops);
  const points = state.geometry.points;
  if (!points.length) return null;

  const endPt = points[points.length - 1];
  // Offset the badge to the lower-right of the thread endpoint so it never
  // covers the last data point sitting exactly on the curve's end.
  const BADGE_OFFSET = 16;
  const badge = { x: endPt.x + BADGE_OFFSET, y: endPt.y + BADGE_OFFSET };

  // Read the real canvas box (#canvas) so the panel never leaves the canvas.
  const canvasEl = typeof document !== 'undefined' ? document.getElementById('canvas') : null;
  const cw = canvasEl ? canvasEl.clientWidth : 100000;
  const ch = canvasEl ? canvasEl.clientHeight : 100000;

  const openLeft = badge.x + 14 + PANEL_W > cw;
  let panelX = openLeft ? badge.x - 14 - PANEL_W : badge.x + 14;
  if (panelX < 4) panelX = 4;
  let panelY = badge.y - 10;
  if (panelY + PANEL_H > ch) panelY = ch - PANEL_H - 4;
  if (panelY < 4) panelY = 4;

  function togglePanel() {
    updateObject(obj.id, { data: { panelOpen: !obj.data.panelOpen } });
  }

  function removeCard(idx) {
    const next = ops.filter((_, i) => i !== idx);
    if (next.length === 0) {
      removeObject(obj.id);
    } else {
      updateObject(obj.id, { data: { ops: next } });
    }
  }

  function toggleCard(idx) {
    const next = ops.map((c, i) => (i === idx ? { ...c, enabled: c.enabled === false } : c));
    updateObject(obj.id, { data: { ops: next } });
    force((n) => n + 1);
  }

  function onDrop(e) {
    const columnId = e.dataTransfer.getData('application/mt-column');
    setDragOver(false);
    if (!columnId) return;
    e.preventDefault();
    e.stopPropagation();
    for (const fn of threadDropHandlers) {
      if (fn(obj, columnId)) break;
    }
  }

  const pathD = pointsToPath(points);

  return (
    <g>
      {/* wide transparent hit-area for dropping data columns onto the thread */}
      <path
        d={pathD}
        fill="none"
        stroke="#000"
        strokeOpacity={dragOver ? 0.08 : 0}
        strokeWidth={22}
        strokeLinecap="round"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      />
      <path className="thread-curve" d={pathD} style={{ pointerEvents: 'none' }} />

      {/* feature layers (e.g. bind-data data points) */}
      {threadLayers.map((Layer, i) => (
        <Layer key={i} obj={obj} state={state} points={points} />
      ))}

      {/* thin connector from the curve end to the offset badge (visual cue) */}
      <line
        x1={endPt.x}
        y1={endPt.y}
        x2={badge.x}
        y2={badge.y}
        stroke="#a855f7"
        strokeWidth={1}
        strokeOpacity={0.5}
        style={{ pointerEvents: 'none' }}
      />

      <circle className="thread-badge" cx={badge.x} cy={badge.y} r={9} onClick={togglePanel} />
      <text
        x={badge.x}
        y={badge.y + 3.5}
        fontSize={11}
        fill="#fff"
        textAnchor="middle"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {ops.length}
      </text>

      {obj.data.panelOpen && (
        <foreignObject x={panelX} y={panelY} width={PANEL_W} height={PANEL_H}>
          <div className="card-panel" style={{ position: 'relative' }}>
            <div className="card-panel-header">
              <span>Function Cards (run in order)</span>
              <span className="close" onClick={togglePanel}>✕</span>
            </div>
            <div className="card-panel-list">
              {ops.map((card, idx) => (
                <div key={idx} className={`op-card ${card.enabled === false ? 'disabled' : ''}`}>
                  <div>
                    <div className="op-name">{idx + 1}. {cardLabel(card)}</div>
                    <div className="op-sub">{card.enabled === false ? 'Disabled' : 'Enabled'}</div>
                  </div>
                  <div className="op-actions">
                    <button className="op-btn" title="Enable/Disable" onClick={() => toggleCard(idx)}>
                      {card.enabled === false ? '□' : '☑'}
                    </button>
                    <button className="op-btn danger" title="Delete" onClick={() => removeCard(idx)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

registerRenderer({
  type: 'thread',
  render: (obj) => <ThreadView obj={obj} />,
});
