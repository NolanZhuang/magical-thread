import React from 'react';
import { createRoot } from 'react-dom/client';
import './features.js'; // registers every feature
import { Canvas } from './canvas/Canvas.jsx';
import { Toolbar } from './canvas/Toolbar.jsx';

function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      <Toolbar />
      <Canvas />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
