/**
 * LEGACY CLIENT-SIDE ENTRYPOINT: main.tsx
 * 
 * ISOLATION NOTICE:
 * This entrypoint is part of the legacy standalone client bundle (Vite/Webpack)
 * and is NOT compiled, loaded, or executed by Next.js Turbopack / App Router.
 * Next.js serves the application strictly via `app/layout.tsx` and the App Router.
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
