// Registry: features register themselves here; the core discovers them.
// Adding a feature never requires editing the core.

export const registry = {
  tools: new Map(),       // id -> Tool
  operations: new Map(),  // id -> Operation
  renderers: new Map(),   // type -> ObjectRendererDef
};

/** Tool: { id, label, onPointerDown?, onPointerMove?, onPointerUp? } */
export function registerTool(tool) {
  registry.tools.set(tool.id, tool);
}

/** Operation: { id, label, canApply(target), apply(target, ctx) } */
export function registerOperation(op) {
  registry.operations.set(op.id, op);
}

/** Renderer: { type, render(obj, ctx) => JSX } */
export function registerRenderer(def) {
  registry.renderers.set(def.type, def);
}

export const listTools = () => Array.from(registry.tools.values());
export const listOperations = () => Array.from(registry.operations.values());
