import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { NearProvider } from './providers/near-provider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NearProvider><App /></NearProvider>
  </React.StrictMode>,
);
