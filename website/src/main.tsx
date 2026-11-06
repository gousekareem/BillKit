/* BillKit client entry. © 2026 Shaik Gouse Kareem. All rights reserved. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import { AppRoutes } from './App';
import { AuthProvider } from './services/auth';
import { ToastProvider } from './services/toast';
import { applyTheme, initialTheme } from './services/theme';

applyTheme(initialTheme());

// The prerendered HTML (for SEO / no-JS readers) is replaced by the live app.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
