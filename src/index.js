import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const isLocalhost =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const root = ReactDOM.createRoot(document.getElementById('root'));

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

const clearCachesAndRender = () => {
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .finally(renderApp);
  } else {
    renderApp();
  }
};

// Keep local development cache-free to avoid Chrome stale-shell/login loops.
if ('serviceWorker' in navigator) {
  if (process.env.NODE_ENV === 'production' && !isLocalhost) {
    // Always render app in production; service worker registration is async.
    renderApp();
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .finally(clearCachesAndRender);
  }
} else {
  clearCachesAndRender();
}

reportWebVitals();
