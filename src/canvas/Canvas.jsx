import React, { useRef } from 'react';
import { useStore } from '../core/store.js';
import { registry } from '../core/registry.js';
import { ObjectRenderer } from './ObjectRenderer.jsx';

// Main canvas. Renders every object and forwards pointer events to the active tool.
export function Canvas() {
  const objects = useStore((s) => s.objects);
  const activeToolId = useStore((s) => s.activeToolId);
  const svgRef = useRef(null);

  const toolCtx = { store: useStore.getState };

  function toLocal(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const activeTool = activeToolId ? registry.tools.get(activeToolId) : null;

  const handlers = {
    onPointerDown: (e) => activeTool?.onPointerDown?.(toLocal(e), toolCtx),
    onPointerMove: (e) => activeTool?.onPointerMove?.(toLocal(e), toolCtx),
    onPointerUp: (e) => activeTool?.onPointerUp?.(toLocal(e), toolCtx),
  };

  // Objects that have a canvas renderer (columnCard has none -> stays in sidebar only).
  const drawable = objects.filter((o) => registry.renderers.has(o.type));

  return (
    <div id="canvas-wrap">
      <div
        id="canvas"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => activeTool?.onDrop?.(e, toolCtx) ?? window.__mtOnDrop?.(e)}
      >
        {drawable.length === 0 && (
          <div id="canvas-empty-hint">
            <span className="big">✏️</span>
            Pick “Draw Thread” above, then drag on the canvas to draw a thread.
          </div>
        )}
        <svg id="canvas-svg" ref={svgRef} {...handlers}>
          {drawable.map((obj) => (
            <ObjectRenderer key={obj.id} obj={obj} ctx={{ svgRef }} />
          ))}
          {/* transient overlays (e.g. live drawing preview) */}
          {registry.renderers.has('__drawPreview') && (
            <ObjectRenderer obj={{ id: '__drawPreview', type: '__drawPreview', data: {} }} ctx={{ svgRef }} />
          )}
        </svg>
      </div>
    </div>
  );
}
