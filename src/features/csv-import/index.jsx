// FEATURE: csv-import
// Drag a .csv file onto the canvas -> parse it -> create one Column Card per column.
// Column cards live ONLY in the sidebar (they are NOT rendered on the canvas).

import { csvParse } from 'd3-dsv';
import { useStore } from '../../core/store.js';
import { makeObject } from '../../core/types.js';

// --- Handle the file drop (registered on window so it works without an active tool) ---
function handleDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || !file.name.toLowerCase().endsWith('.csv')) return;

  const reader = new FileReader();
  reader.onload = () => {
    const rows = csvParse(reader.result);
    const columns = rows.columns || [];
    const add = useStore.getState().addObject;

    columns.forEach((col) => {
      const values = rows.map((r) => r[col]);
      add(
        makeObject('columnCard', { column: col, values }, { name: col })
      );
    });
  };
  reader.readAsText(file);
}

// Expose to the canvas drop handler (see Canvas.jsx onDrop fallback).
window.__mtOnDrop = handleDrop;

// NOTE: no renderer is registered for 'columnCard'.
// Column cards are shown by the Sidebar only, never drawn on the canvas.
