import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './erro/ErrorBoundary';
import { ThemeProvider } from './theme/ThemeProvider';
import '@fontsource-variable/ibm-plex-sans';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não existe no index.html.');

createRoot(container).render(
  <StrictMode>
    {/* Fora do roteador: o tema vale também para a tela de login. */}
    <ThemeProvider>
      {/*
        A BORDA DA RAIZ — a última rede, e ela fica DENTRO do tema.

        Dentro porque a tela de erro usa os mesmos tokens do painel, e uma tela
        clara estourando na cozinha às 22h, em cima de um painel escuro, é
        agressão gratuita em cima de um problema.

        Ela pega o que quebra no roteador, na sessão e na moldura — tudo o que
        está acima da borda de dentro do `AppShell` e que, quebrando, apagava a
        tela inteira. Ver `erro/ErrorBoundary.tsx`.
      */}
      <ErrorBoundary escopo="painel">
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
