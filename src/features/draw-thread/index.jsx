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
// It just seeds the geometry from its stored points.
registerThreadOp({
  id: 'draw-thread',
  label: '画 Thread',
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
  label: '✏️ 画 Thread',
  onPointerDown: (pt) => {
    drawing = true;
    pts = [pt];
    window.__mtDrawPreview = pts;
    useStore.getState()._bump?.();
  },
  onPointerMove: (pt) => {
    if (!drawing) return;
    const last = pts[pts.length - 1];
    // sample: only keep points that moved a little, to avoid huge arrays
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 3) {
      pts.push(pt);
      window.__mtDrawPreview = [...pts];
      useStore.getState()._bump?.();
    }
  },
  onPointerUp: () => {
    if (!drawing) return;
    drawing = false;
    window.__mtDrawPreview = null;
    if (pts.length >= 2) {
      // A thread = geometry-less; the pipeline (ops) defines everything.
      const obj = makeObject('thread', {
        ops: [{ opId: 'draw-thread', params: { points: pts }, enabled: true }],
        panelOpen: false,
      });
      useStore.getState().addObject(obj);
    }
    pts = [];
    useStore.getState()._bump?.();
  },
});

// --- 3. Renderer for a Thread object ---
function ThreadView({ obj }) {
  const updateObject = useStore((s) => s.updateObject);
  const removeObject = useStore((s) => s.removeObject);
  const [, force] = useState(0);

  const ops = obj.data.ops || [];
  const state = runPipeline(ops);
  const points = state.geometry.points;
  if (!points.length) return null;

  // badge position = last point of the curve
  const badge = points[points.length - 1];

  function togglePanel() {
    updateObject(obj.id, { data: { panelOpen: !obj.data.panelOpen } });
  }

  function removeCard(idx) {
    const next = ops.filter((_, i) => i !== idx);
    if (next.length === 0) {
      // no cards left -> the thread ceases to exist
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
      {/* function badge */}
      <circle
        className="thread-badge"
        cx={badge.x}
        cy={badge.y}
        r={9}
        onClick={togglePanel}
      />
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

      {/* the panel of function cards (rendered as a foreignObject so we can use HTML) */}
      {obj.data.panelOpen && (
        <foreignObject x={badge.x + 14} y={badge.y - 10} width={220} height={400}>
          <div className="card-panel" style={{ position: 'relative' }}>
            <div className="card-panel-header">
              <span>功能卡片（按顺序执行）</span>
              <span className="close" onClick={togglePanel}>✕</span>
            </div>
            <div className="card-panel-list">
              {ops.map((card, idx) => (
                <div key={idx} className={`op-card ${card.enabled === false ? 'disabled' : ''}`}>
                  <div>
                    <div className="op-name">{idx + 1}. {card.opId}</div>
                    <div className="op-sub">{card.enabled === false ? '已禁用' : '启用中'}</div>
                  </div>
                  <div className="op-actions">
                    <button className="op-btn" title="启用/禁用" onClick={() => toggleCard(idx)}>
                      {card.enabled === false ? '□' : '☑'}
                    </button>
                    <button className="op-btn danger" title="删除" onClick={() => removeCard(idx)}>✕</button>
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
