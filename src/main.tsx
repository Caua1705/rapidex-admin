import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import '@fontsource-variable/ibm-plex-sans';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não existe no index.html.');

createRoot(container).render(
  <StrictMode>
    {/* Fora do roteador: o tema vale também para a tela de login. */}
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
