import React from 'react';
import { registry } from '../core/registry.js';

// Renders a single SceneObject by looking up its renderer by type.
// Adding a new object type = registering a new renderer (no edit here).
export function ObjectRenderer({ obj, ctx }) {
  const def = registry.renderers.get(obj.type);
  if (!def) return null;
  return <>{def.render(obj, ctx)}</>;
}
