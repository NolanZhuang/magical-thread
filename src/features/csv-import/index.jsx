// FEATURE: csv-import
// Drag a .csv file onto the canvas -> parse it -> create one Column Card per column.
// Column cards live ONLY in the sidebar (they are NOT rendered on the canvas).
//
// A time-like column (name matching time/date/timestamp/...) is detected once
// per file, and its per-row value is bound DIRECTLY onto every other column
// card, so downstream features (e.g. bind-data) always have a reliable
// time<->value pairing without positional guessing.

import { csvParse } from 'd3-dsv';
import { useStore } from '../../core/store.js';
import { makeObject } from '../../core/types.js';

const TIME_RE = /(time|date|timestamp|datetime|day|month|year|hour|min|sec|时间|日期)/i;

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

    // Detect the time column (first column whose name looks temporal).
    const timeColName = columns.find((c) => TIME_RE.test(c)) || null;
    const timeValues = timeColName ? rows.map((r) => r[timeColName]) : null;

    columns.forEach((col) => {
      const rawValues = rows.map((r) => r[col]);
      // Bind time directly to each value: { time, value }.
      // If no time column exists, fall back to the row index as the "time".
      const values = rawValues.map((v, i) => ({
        time: timeValues ? timeValues[i] : i,
        value: v,
      }));
      add(
        makeObject(
          'columnCard',
          { column: col, values, timeColumn: timeColName || 'index' },
          { name: col }
        )
      );
    });
  };
  reader.readAsText(file);
}

// Expose to the canvas drop handler (see Canvas.jsx onDrop fallback).
window.__mtOnDrop = handleDrop;

// NOTE: no renderer is registered for 'columnCard'.
// Column cards are shown by the Sidebar only, never drawn on the canvas.