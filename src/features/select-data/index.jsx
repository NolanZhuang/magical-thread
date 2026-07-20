// FEATURE: select-data
// Adds two tools next to "Draw Thread":
//   - Select Data Point     : click a dot -> toggle that single point.
//   - Select Data Interval  : click two dots on the same thread -> select every
//                             point between them (inclusive). The first click
//                             sets an anchor; the second click closes the span.
//
// Selecting is ADDITIVE: new points/intervals are merged into whatever was
// already selected (existing selection is never cleared).
//
// Selection is stored NON-DESTRUCTIVELY as a 'select' pipeline card on the
// thread (state.selection holds STABLE original indices). Selected dots are
// rendered black by the bind-data layer (which reads state.selection).
//
// Decoupling: this feature never edits bind-data or draw-thread. It receives
// dot clicks through the window.__mtOnDotClick hook that bind-data invokes, and
// it registers its own tools so the toolbar shows buttons automatically.

import { registerThreadOp } from '../../core/threadEngine.js';
import { registerTool } from '../../core/registry.js';
import { useStore } from '../../core/store.js';

// --- The pipeline card: applies a stored selection onto the ThreadState ---
registerThreadOp({
  id: 'select',
  label: 'Select',
  apply: (state, params) => ({
    ...state,
    selection: Array.isArray(params.selection) ? params.selection : [],
  }),
});

// --- Tools: they don't act on canvas pointer events directly; they just mark
//     the current "selection mode". The real work happens on dot clicks. ---
const MODES = {
  'select-point': '🎯 Select Data Point',
  'select-interval': '⟷ Select Interval',
};
for (const id of Object.keys(MODES)) {
  registerTool({ id, label: MODES[id] });
}

// Transient anchor for interval selection: { threadId, index }.
let intervalAnchor = null;

// Read/write the 'select' card on a thread's pipeline.
function getSelection(obj) {
  const card = (obj.data.ops || []).find((c) => c.opId === 'select');
  return card?.params?.selection || [];
}
function setSelection(obj, selection) {
  const ops = obj.data.ops || [];
  const idx = ops.findIndex((c) => c.opId === 'select');
  // de-duplicate + sort for a clean, stable selection array
  const clean = Array.from(new Set(selection)).sort((a, b) => a - b);
  const card = { opId: 'select', params: { selection: clean }, enabled: true };
  const next = idx >= 0 ? ops.map((c, i) => (i === idx ? card : c)) : [...ops, card];
  useStore.getState().updateObject(obj.id, { data: { ops: next } });
}

// --- The dot-click hook, invoked by bind-data with (obj, clickedIndex) ---
// `clickedIndex` is the STABLE original row index of the clicked dot.
const prevDotClick = window.__mtOnDotClick;
window.__mtOnDotClick = (obj, clickedIndex) => {
  const mode = useStore.getState().activeToolId;

  if (mode === 'select-point') {
    // Toggle a single point (additive/removable), keeping the rest intact.
    const cur = getSelection(obj);
    const has = cur.includes(clickedIndex);
    const next = has ? cur.filter((i) => i !== clickedIndex) : [...cur, clickedIndex];
    setSelection(obj, next);
    return;
  }

  if (mode === 'select-interval') {
    const cur = getSelection(obj);
    if (!intervalAnchor || intervalAnchor.threadId !== obj.id) {
      // First click: set the anchor and ADD it to the existing selection.
      intervalAnchor = { threadId: obj.id, index: clickedIndex };
      setSelection(obj, [...cur, clickedIndex]);
      return;
    }
    // Second click: MERGE the whole span between anchor and this dot into the
    // existing selection (previous selection is preserved).
    const a = Math.min(intervalAnchor.index, clickedIndex);
    const b = Math.max(intervalAnchor.index, clickedIndex);
    const span = [];
    for (let i = a; i <= b; i++) span.push(i);
    setSelection(obj, [...cur, ...span]);
    intervalAnchor = null;
    return;
  }

  // No selection mode active -> defer to any previous hook.
  if (prevDotClick) prevDotClick(obj, clickedIndex);
};

// Reset the pending interval anchor whenever the tool changes, so switching
// modes never leaves a dangling half-selection.
let lastTool = useStore.getState().activeToolId;
useStore.subscribe((s) => {
  if (s.activeToolId !== lastTool) {
    lastTool = s.activeToolId;
    intervalAnchor = null;
  }
});

// --- Card label: show how many points are selected ---
const prevLabel = window.__mtCardLabel;
window.__mtCardLabel = (card) => {
  if (card.opId === 'select') {
    const n = card.params?.selection?.length || 0;
    return `select → ${n} point${n === 1 ? '' : 's'}`;
  }
  return prevLabel ? prevLabel(card) : card.opId;
};