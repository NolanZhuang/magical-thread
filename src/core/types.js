// Core object model. Everything on the canvas is a SceneObject.
// (JS + JSDoc so you get editor hints without needing TypeScript.)

/**
 * @typedef {Object} SceneObject
 * @property {string} id
 * @property {string} type   e.g. 'thread' | 'columnCard' | 'selection' | 'chart'
 * @property {string} [name] user-editable name (enables Reuse)
 * @property {number} [x]
 * @property {number} [y]
 * @property {Object} data   type-specific fields; the core never inspects this
 */

let counter = 0;
export function newId(prefix = 'obj') {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

/** Create a SceneObject. */
export function makeObject(type, data = {}, extra = {}) {
  return { id: newId(type), type, data, ...extra };
}
