# Magical Thread

A flexible, object-oriented system for non-programmers to create and explore data visualizations by drawing and manipulating **threads**.

Built on three principles (Beaudouin-Lafon & Mackay, CHI 2000):
**Reification** (everything is a first-class object), **Polymorphism** (one operation, many targets), **Reuse** (name & reapply).

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Architecture (why it's easy to iterate)

Everything is a **plugin (feature module)**. The core never changes when you add a feature.

```
src/
  core/        # foundation, rarely touched
    types.js       # shared factory helpers + JSDoc typedefs
    store.js       # central Zustand state (all objects live here)
    registry.js    # tools / operations / renderers register themselves here
  canvas/      # rendering + interaction framework, rarely touched
    Canvas.jsx        # main SVG canvas, renders every object in the store
    ObjectRenderer.jsx# looks up a renderer by object.type
    Toolbar.jsx       # auto-builds buttons from registered tools
  features/    # >>> ONE FOLDER PER FEATURE <<<
    csv-import/
  features.js  # the ONE integration point: import every feature here
  main.jsx     # entry
```

## How to add a new feature (the whole workflow)

1. Create `src/features/<your-feature>/index.jsx`.
2. In it, write your logic and call `registerTool(...)`, `registerOperation(...)`,
   and/or `registerRenderer(...)` at the bottom.
3. Add ONE line to `src/features.js`: `import './features/<your-feature>';`

That's it. You never edit old files. See `features/csv-import` as the template.
