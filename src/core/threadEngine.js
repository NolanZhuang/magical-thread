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

// ============================================================================
// Arc-length utilities on a curve's sample points.
// Shared capability: any feature that needs to place things "along the thread"
// (bind-data, select, sort, custom spacing, axis ticks, ...) uses these.
// Additive only — never changes existing behaviour.
// ============================================================================

// Precompute cumulative arc-length for a polyline so we can map t in [0,1]
// (fraction of total length) to an {x, y} point on the curve.
export function buildArcLength(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = cum[cum.length - 1] || 0;
  return { points, cum, total };
}

// Point at fraction t (0..1) along the curve, by arc length.
export function pointAtT(arc, t) {
  const { points, cum, total } = arc;
  if (!points || points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || total === 0) return { ...points[0] };
  const target = Math.max(0, Math.min(1, t)) * total;
  // find the segment containing `target`
  let i = 1;
  while (i < cum.length && cum[i] < target) i++;
  const d0 = cum[i - 1], d1 = cum[i];
  const f = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
  const a = points[i - 1], b = points[i];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Convenience: evenly place `n` points along the curve by arc length.
// If n === 1, returns the midpoint. Endpoints are included when n >= 2.
export function placeAlong(points, n) {
  const arc = buildArcLength(points);
  const out = [];
  if (n <= 0) return out;
  if (n === 1) return [pointAtT(arc, 0.5)];
  for (let k = 0; k < n; k++) out.push(pointAtT(arc, k / (n - 1)));
  return out;
}
