import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { GymProvider } from './context/GymContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GymProvider>
      <App />
    </GymProvider>
  </React.StrictMode>,
);
