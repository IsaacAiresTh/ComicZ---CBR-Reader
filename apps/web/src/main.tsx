import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/router';
import { Providers } from './app/providers';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root nao encontrado');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <AppRouter />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
