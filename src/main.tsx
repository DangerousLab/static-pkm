import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Get root element with type safety
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[ERROR] [main] Root element not found');
}

// Initialize React app
console.log('[INFO] [main] Initializing React application');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
