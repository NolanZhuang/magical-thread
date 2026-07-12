// ============================================================================
// Thread pipeline engine  —  THE FOUNDATION for order-sensitive features.
//
// A Thread object stores ONLY:
//   - geometry: the curve shape (sample points)
//   - ops:      an ORDERED list of operation cards, e.g.
//               [ {opId:'draw-thread', params, enabled}, {opId:'bind-data',...}, ... ]
//
// The visible/derived result is computed by RUNNING the ops in order:
//   finalState = op3.apply(op2.apply(op1.apply(initialState)))
//
// Each operation is a PURE function registered via registerThreadOp():
//   apply(state, params) => newState
//
// WHY THIS MATTERS:
//   * Order sensitivity is automatic (select-then-sort != sort-then-select).
//   * Deleting/disabling a card just re-runs the pipeline; its effect vanishes.
//   * Adding a NEW feature = register a new op. Old ops never change.
//     They only need to respect the same ThreadState "envelope" below.
// ============================================================================

// ---- The ThreadState envelope (keep this stable!) --------------------------
// {
//   geometry:  { points: [{x,y}, ...] },   // the curve
//   rows:      [ {index, ...fields}, ... ], // current data sequence (order = position on thread)
//                                           //   `index` is the STABLE original row index.
//   selection: [originalIndex, ...],        // selected rows, stored by STABLE index
//   scale:     {} ,                         // value->position mapping params
//   meta:      {}                           // anything else derived
// }

export function emptyThreadState() {
  return { geometry: { points: [] }, rows: [], selection: [], scale: {}, meta: {} };
}

// Registry of thread operations: opId -> { id, label, apply }
const threadOps = new Map();

/** Register a thread operation. { id, label, apply(state, params) => newState } */
export function registerThreadOp(op) {
  threadOps.set(op.id, op);
}

export function getThreadOp(id) {
  return threadOps.get(id);
}

// Run the ordered op list to produce the derived ThreadState.
export function runPipeline(ops) {
  let state = emptyThreadState();
  for (const card of ops || []) {
    if (card.enabled === false) continue;      // disabled cards are skipped
    const op = threadOps.get(card.opId);
    if (!op) continue;                          // unknown op (feature not loaded) -> skip
    try {
      state = op.apply(state, card.params || {}) || state;
    } catch (err) {
      console.error(`thread op "${card.opId}" failed:`, err);
    }
  }
  return state;
}
