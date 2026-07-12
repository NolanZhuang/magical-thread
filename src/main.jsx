import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './features.js'; // registers every feature
import { Toolbar } from './canvas/Toolbar.jsx';
import { Sidebar } from './canvas/Sidebar.jsx';
import { Canvas } from './canvas/Canvas.jsx';

function App() {
  return (
    <>
      <Toolbar />
      <div id="main">
        <Sidebar />
        <Canvas />
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
