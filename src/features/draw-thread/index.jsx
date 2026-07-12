// FEATURE: draw-thread
// Adds a "draw thread" tool. Freehand-draw on the canvas -> creates a Thread object.
// A Thread stores an ORDERED list of operation cards (its pipeline). Its first card
// is this "draw-thread" op, which simply provides the geometry. Deleting that card
// removes the whole thread.
//
// Self-contained: registers a Tool, a thread-op, and a renderer. Edits no old files.

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
// window.__mtCardLabel. If absent, we just show the opId. This keeps features
// decoupled: any feature can customise how its own card is labelled.
function cardLabel(card) {
  const fn = window.__mtCardLabel;
  return (fn && fn(card)) || card.opId;
}

// --- 4. Renderer for a Thread object ---
const PANEL_W = 220;
const PANEL_H = 400;

function ThreadView({ obj, ctx }) {
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const [, force] = useState(0);

  const ops = obj.data.ops || [];
  const state = runPipeline(ops);
  const points = state.geometry.points;
  if (!points.length) return null;

  const badge = points[points.length - 1];

  // Figure out the canvas size so the panel never overflows off-screen.
  const svg = ctx?.svgRef?.current;
  const rect = svg ? svg.getBoundingClientRect() : { width: 99999, height: 99999 };
  const canvasW = rect.width;
  const canvasH = rect.height;

  // Default: open to the right of the badge. If that would overflow the right
  // edge, open to the LEFT instead. Same idea vertically.
  const openLeft = badge.x + 14 + PANEL_W > canvasW;
  const panelX = openLeft ? badge.x - 14 - PANEL_W : badge.x + 14;
  let panelY = badge.y - 10;
  if (panelY + PANEL_H > canvasH) panelY = Math.max(4, canvasH - PANEL_H - 4);
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

  return (
    <g>
      <path className="thread-curve" d={pointsToPath(points)} />
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
  render: (obj, ctx) => <ThreadView obj={obj} ctx={ctx} />,
});
