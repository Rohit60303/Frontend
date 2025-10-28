import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';  // Added .js extension
import reportWebVitals from './reportWebVitals.js';  // Added .js extension

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Web Vitals reporting
reportWebVitals();