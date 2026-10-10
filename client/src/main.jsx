import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { getLanguage } from './i18n/index.js';
import './index.css';

// The page is served in English; a device set to Indonesian says so before the first paint.
document.documentElement.lang = getLanguage();

// iOS Safari applies :active only with a touch listener on the element or an ancestor.
document.addEventListener('touchstart', () => {}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
