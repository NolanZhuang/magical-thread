// FEATURE: move-point
// Adds a "Move Point" tool next to the others. While active, you can DRAG any
// data dot along the thread to reposition just that point — other points stay
// put. Repeat to move as many points as you like.
//
// Positions are stored NON-DESTRUCTIVELY as a 'move-point' pipeline card whose
// params.overrides maps a STABLE row index -> t (fraction of arc length in
// [0,1]). The op writes these into state.meta.pointT; bind-data reads them when
// placing dots. Disable/delete the card -> points snap back to even spacing.
//
// Decoupling: this feature never edits bind-data or draw-thread. bind-data's
// dots invoke window hooks that this feature owns:
//   - window.__mtIsPointDragMode()          -> is this tool active?
//   - window.__mtOnPointMove(obj, index, t) -> record a dragged position.

import { registerThreadOp } from '../../core/threadEngine.js';
import { registerTool } from '../../core/registry.js';
import { useStore } from '../../core/store.js';

// --- The pipeline card: apply stored per-point position overrides ---
registerThreadOp({
  id: 'move-point',
  label: 'Move Point',
  apply: (state, params) => ({
    ...state,
    meta: { ...state.meta, pointT: { ...(params.overrides || {}) } },
  }),
});

// --- Tool: pure "mode" marker; the real work happens on dot drags ---
registerTool({ id: 'move-point', label: '✋ Move Point' });

// Is the Move Point tool currently active? (bind-data checks this before drag.)
window.__mtIsPointDragMode = () => useStore.getState().activeToolId === 'move-point';

// Read/write the 'move-point' card's overrides on a thread's pipeline.
function getOverrides(obj) {
  const card = (obj.data.ops || []).find((c) => c.opId === 'move-point');
  return { ...(card?.params?.overrides || {}) };
}
function setOverride(obj, index, t) {
  const ops = obj.data.ops || [];
  const idx = ops.findIndex((c) => c.opId === 'move-point');
  const overrides = getOverrides(obj);
  overrides[index] = Math.max(0, Math.min(1, t));
  const card = { opId: 'move-point', params: { overrides }, enabled: true };
  const next = idx >= 0 ? ops.map((c, i) => (i === idx ? card : c)) : [...ops, card];
  useStore.getState().updateObject(obj.id, { data: { ops: next } });
}

// Invoked continuously by bind-data while dragging a dot.
window.__mtOnPointMove = (obj, index, t) => setOverride(obj, index, t);

// --- Card label: show how many points were moved ---
const prevLabel = window.__mtCardLabel;
window.__mtCardLabel = (card) => {
  if (card.opId === 'move-point') {
    const n = Object.keys(card.params?.overrides || {}).length;
    return `move-point → ${n} moved`;
  }
  return prevLabel ? prevLabel(card) : card.opId;
};