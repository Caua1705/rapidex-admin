import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { KitchenPage } from './kitchen/KitchenPage';
import { AppShell } from './layout/AppShell';
import { MenuPage } from './menu/MenuPage';
import { OrdersPage } from './orders/OrdersPage';
import { LoginPage } from './pages/LoginPage';
import { StorePage } from './store/StorePage';

/**
 * Login, pedidos, cardápio, minha loja e cozinha.
 *
 * A COZINHA É A ÚNICA TELA AUTENTICADA FORA DO <AppShell>: ela é um monitor
 * pendurado na parede da cozinha e usa a tela inteira, sem navegação lateral
 * nem barra do topo. Envolvê-la no AppShell "por consistência" devolveria os
 * 200px da lateral e os 56px do cabeçalho a uma tela cuja razão de existir é
 * ser lida de longe. A saída dela é o link no próprio canto.
 *
 * Clientes e relatórios entram como irmãos de /cardapio, sem mexer em mais nada.
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
          <Route
            path="/minha-loja"
            element={
              <RequireAuth>
                <AppShell>
                  <StorePage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/cozinha"
            element={
              <RequireAuth>
                <KitchenPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/pedidos" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
