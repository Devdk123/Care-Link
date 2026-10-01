import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { AuthProvider as LibAuthProvider } from './lib/auth';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibAuthProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LibAuthProvider>
  </StrictMode>,
);
