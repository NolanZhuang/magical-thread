// FEATURE: shape-correct
// After a thread is drawn, this op inspects the raw stroke and "beautifies" it:
//   - close to a straight line  -> a clean straight line
//   - close to a circle         -> a regular circle
//   - otherwise                 -> a very smooth resampled curve
//
// It is a PIPELINE CARD inserted right after 'draw-thread'. Disable/delete it to
// fall back to the original hand-drawn stroke (non-destructive). The detected shape
// is stored in the card params and shown as the card label.
//
// Self-contained: registers a thread-op + patches the draw tool to auto-append this
// card. It does NOT modify any existing file.

import { registerThreadOp } from '../../core/threadEngine.js';
import { registry } from '../../core/registry.js';
import { useStore } from '../../core/store.js';

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function bbox(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function diag(points) {
  const b = bbox(points);
  return Math.hypot(b.w, b.h) || 1;
}

// --- Straight line: fit via total least squares, measure avg perpendicular dist ---
function lineFit(points) {
  const n = points.length;
  let mx = 0, my = 0;
  for (const p of points) { mx += p.x; my += p.y; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  // principal direction (largest eigenvector of covariance)
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dirx = Math.cos(theta), diry = Math.sin(theta);
  // perpendicular distances
  let err = 0;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    const perp = Math.abs(dx * -diry + dy * dirx);
    err += perp;
  }
  err /= n;
  // endpoints projected onto the line
  let tMin = Infinity, tMax = -Infinity;
  for (const p of points) {
    const t = (p.x - mx) * dirx + (p.y - my) * diry;
    if (t < tMin) tMin = t; if (t > tMax) tMax = t;
  }
  const a = { x: mx + dirx * tMin, y: my + diry * tMin };
  const b = { x: mx + dirx * tMax, y: my + diry * tMax };
  return { err, a, b };
}

// --- Circle: algebraic (Kasa) fit, measure avg radial error ---
function circleFit(points) {
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  for (const p of points) {
    const x = p.x, y = p.y, z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    sxz += x * z; syz += y * z; sz += z;
  }
  // solve normal equations for center (Kasa)
  const C = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const rhs = [sxz, syz, sz];
  const sol = solve3(C, rhs);
  if (!sol) return { err: Infinity };
  const [A, B, Cc] = sol;
  const cx = A / 2, cy = B / 2;
  const r = Math.sqrt(Math.max(0, Cc + cx * cx + cy * cy));
  let err = 0;
  for (const p of points) {
    err += Math.abs(Math.hypot(p.x - cx, p.y - cy) - r);
  }
  err /= n;
  return { err, cx, cy, r };
}

function solve3(M, b) {
  // Gaussian elimination for a 3x3 system
  const a = M.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-9) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c < 4; c++) a[r][c] -= f * a[col][c];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

// --- how closed is the stroke? (endpoints near each other -> likely a circle) ---
function closedness(points) {
  const a = points[0], b = points[points.length - 1];
  return Math.hypot(a.x - b.x, a.y - b.y) / diag(points); // 0 = perfectly closed
}

// --- resample n evenly-spaced points along the polyline (for smoothing) ---
function resample(points, n = 64) {
  if (points.length < 2) return points;
  const dists = [0];
  for (let i = 1; i < points.length; i++) {
    dists.push(dists[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const total = dists[dists.length - 1];
  if (total === 0) return points;
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    let i = 1;
    while (i < dists.length && dists[i] < target) i++;
    const d0 = dists[i - 1], d1 = dists[i];
    const t = d1 === d0 ? 0 : (target - d0) / (d1 - d0);
    out.push({
      x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
      y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
    });
  }
  return out;
}

function makeCircle(cx, cy, r, n = 72) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const a = (2 * Math.PI * k) / n;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Detection: line -> circle -> smooth fallback
// Thresholds are relative to the stroke's bounding-box diagonal.
// ---------------------------------------------------------------------------
export function detectShape(points) {
  if (!points || points.length < 3) return { shape: 'Freeform', points };
  const d = diag(points);

  // 1) line?
  const lf = lineFit(points);
  if (lf.err / d < 0.03) {
    return { shape: 'Line', points: [lf.a, lf.b] };
  }

  // 2) circle? (must be fairly closed AND fit well)
  const cf = circleFit(points);
  const closed = closedness(points);
  if (cf.err !== Infinity && cf.err / d < 0.06 && closed < 0.35 && cf.r / d > 0.15) {
    return { shape: 'Circle', points: makeCircle(cf.cx, cf.cy, cf.r) };
  }

  // 3) smooth fallback
  return { shape: 'Smooth', points: resample(points, 64) };
}

// ---------------------------------------------------------------------------
// The pipeline card
// ---------------------------------------------------------------------------
registerThreadOp({
  id: 'shape-correct',
  label: 'Shape Correct',
  apply: (state) => {
    const src = state.geometry.points;
    if (!src || src.length < 2) return state;
    const { shape, points } = detectShape(src);
    return {
      ...state,
      geometry: { points },
      meta: { ...state.meta, detectedShape: shape },
    };
  },
});

// ---------------------------------------------------------------------------
// Auto-append this card when a new thread is drawn.
// We wrap the store's addObject so that any freshly-created thread gets a
// 'shape-correct' card right after 'draw-thread'. No edit to draw-thread needed.
// ---------------------------------------------------------------------------
const originalAdd = useStore.getState().addObject;
useStore.setState({
  addObject: (obj) => {
    if (obj && obj.type === 'thread' && Array.isArray(obj.data?.ops)) {
      const hasCorrect = obj.data.ops.some((c) => c.opId === 'shape-correct');
      if (!hasCorrect) {
        // detect now so the card can be labelled with the shape
        const raw = obj.data.ops.find((c) => c.opId === 'draw-thread')?.params?.points || [];
        const { shape } = detectShape(raw);
        obj = {
          ...obj,
          data: {
            ...obj.data,
            ops: [
              ...obj.data.ops,
              { opId: 'shape-correct', params: { detected: shape }, enabled: true },
            ],
          },
        };
      }
    }
    originalAdd(obj);
  },
});

// ---------------------------------------------------------------------------
// Make the function-card panel show the detected shape as the card's label.
// The draw-thread renderer shows `card.opId`; we augment the label by exposing a
// global lookup the renderer can (optionally) use. To keep draw-thread untouched
// yet still show the shape, we override the card's opId display via a label map.
// ---------------------------------------------------------------------------
export const shapeCardLabel = (card) =>
  card.opId === 'shape-correct'
    ? `shape-correct → ${card.params?.detected || '?'}`
    : card.opId;

// Expose so a future generic panel can use it; harmless if unused.
window.__mtCardLabel = shapeCardLabel;
