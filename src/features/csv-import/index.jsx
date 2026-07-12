// FEATURE: csv-import
// Drag a .csv file onto the canvas -> parse it -> create one Column Card per column.
// This file is fully self-contained. It only reads from the core; it edits no old files.

import React from 'react';
import { csvParse } from 'd3-dsv';
import { registerRenderer } from '../../core/registry.js';
import { useStore } from '../../core/store.js';
import { makeObject } from '../../core/types.js';

// --- 1. Handle the file drop (registered on window so it works without an active tool) ---
function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || !file.name.toLowerCase().endsWith('.csv')) return;

  const reader = new FileReader();
  reader.onload = () => {
    const rows = csvParse(reader.result);
    const columns = rows.columns || [];
    const add = useStore.getState().addObject;

    columns.forEach((col, i) => {
      const values = rows.map((r) => r[col]);
      add(
        makeObject('columnCard', { column: col, values }, {
          name: col,
          x: 20,
          y: 20 + i * 70,
        })
      );
    });
  };
  reader.readAsText(file);
}

// Expose to the canvas drop handler (see Canvas.jsx onDrop fallback).
window.__mtOnDrop = handleDrop;

// --- 2. How to render a Column Card ---
registerRenderer({
  type: 'columnCard',
  render: (obj) => {
    const { column, values } = obj.data;
    const preview = values.slice(0, 3).join(', ');
    return (
      <g transform={`translate(${obj.x || 0}, ${obj.y || 0})`}>
        <rect width={160} height={56} rx={8} fill="#fff" stroke="#4f46e5" />
        <text x={10} y={22} fontSize={13} fontWeight="bold" fill="#4f46e5">
          {column}
        </text>
        <text x={10} y={40} fontSize={11} fill="#666">
          {values.length} rows
        </text>
        <text x={10} y={52} fontSize={9} fill="#999">
          {preview}{values.length > 3 ? ' …' : ''}
        </text>
      </g>
    );
  },
});
