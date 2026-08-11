import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { KitchenPage } from './kitchen/KitchenPage';
import { AppShell } from './layout/AppShell';
import { PENDING_ENTRIES } from './layout/nav';
import { MenuPage } from './menu/MenuPage';
import { OrdersPage } from './orders/OrdersPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { StoreLayout } from './store/StoreLayout';
import { StoreSectionPage } from './store/StoreSectionPage';
import { STORE_SECTIONS } from './store/store-sections';
import { UiGalleryPage } from './ui-gallery/UiGalleryPage';

/**
 * As rotas do painel.
 *
 * A COZINHA É A ÚNICA TELA AUTENTICADA FORA DO <AppShell>: ela é um monitor
 * pendurado na parede da cozinha e usa a tela inteira, sem navegação lateral
 * nem barra do topo. Envolvê-la no AppShell "por consistência" devolveria a
 * lateral e o cabeçalho a uma tela cuja razão de existir é ser lida de longe.
 * A saída dela é o link no próprio canto.
 *
 * As seções ainda não construídas viram rota de verdade a partir de
 * `PENDING_ENTRIES` (a mesma lista que desenha a lateral), e não links mortos:
 * um item de navegação que não navega é pior que um item ausente. O destino é
 * a página de estado, que diz o que a tela vai fazer e mais nada.
 */
export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/pedidos"
            element={
              <RequireAuth>
                <AppShell>
                  <OrdersPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/cardapio"
            element={
              <RequireAuth>
                <AppShell>
                  <MenuPage />
                </AppShell>
              </RequireAuth>
            }
          />
          {/*
            MINHA LOJA É UM GRUPO DE ROTAS, uma por seção. A lista da esquerda
            é navegação de verdade — o endereço identifica a tela, o F5 volta
            onde estava e o botão voltar do navegador funciona entre seções.

            `index` redireciona para Geral: /minha-loja sozinha não é uma tela,
            é o nome do grupo. Deixá-la renderizar um estado vazio "escolha uma
            seção" seria uma tela a mais para atravessar toda vez.
          */}
          <Route
            path="/minha-loja"
            element={
              <RequireAuth>
                <AppShell>
                  <StoreLayout />
                </AppShell>
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="geral" replace />} />
            {STORE_SECTIONS.map((secao) => (
              <Route key={secao.id} path={secao.id} element={<StoreSectionPage id={secao.id} />} />
            ))}
          </Route>
          <Route
            path="/cozinha"
            element={
              <RequireAuth>
                <KitchenPage />
              </RequireAuth>
            }
          />

          {/*
            A GALERIA DO DESIGN SYSTEM, só em desenvolvimento.
            `import.meta.env.DEV` é estático: no build de produção o bloco
            inteiro sai do bundle, e a rota simplesmente não existe. Ela também
            fica FORA do <RequireAuth>: é ferramenta de quem constrói a tela,
            não do lojista.
          */}
          {import.meta.env.DEV ? <Route path="/ui" element={<UiGalleryPage />} /> : null}

          {PENDING_ENTRIES.map((entry) => (
            <Route
              key={entry.to}
              path={entry.to}
              element={
                <RequireAuth>
                  <AppShell>
                    <ComingSoonPage title={entry.label} description={entry.soon} />
                  </AppShell>
                </RequireAuth>
              }
            />
          ))}

          <Route path="*" element={<Navigate to="/pedidos" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
