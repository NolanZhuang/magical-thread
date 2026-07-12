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

  return (
    <div
      style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => activeTool?.onDrop?.(e, toolCtx) ?? window.__mtOnDrop?.(e)}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ background: '#fafafa', display: 'block' }}
        {...handlers}
      >
        {objects.map((obj) => (
          <ObjectRenderer key={obj.id} obj={obj} ctx={{ svgRef }} />
        ))}
      </svg>
    </div>
  );
}
