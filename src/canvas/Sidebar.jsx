import React from 'react';
import { useStore } from '../core/store.js';

// Left sidebar: shows the data columns imported from CSV.
export function Sidebar() {
  const objects = useStore((s) => s.objects);
  const removeObject = useStore((s) => s.removeObject);
  const columns = objects.filter((o) => o.type === 'columnCard');

  return (
    <div id="sidebar">
      <div id="data-store">
        <h2>Data Columns</h2>
        {columns.length === 0 && (
          <div id="data-store-empty">
            Drag a <b>.csv</b> file onto the canvas.<br />
            Each column becomes a draggable data card here.
          </div>
        )}
        {columns.map((col) => (
          <div
            key={col.id}
            className="column-card"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/mt-column', col.id);
            }}
          >
            <div>
              <div className="col-name">{col.data.column}</div>
              <div className="col-type">{col.data.values.length} rows</div>
            </div>
            <span
              className="col-delete"
              title="Delete"
              style={{ cursor: 'pointer', color: '#94a3b8' }}
              onClick={() => removeObject(col.id)}
            >
              ✕
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
