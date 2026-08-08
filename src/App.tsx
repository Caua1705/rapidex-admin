import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { AppShell } from './layout/AppShell';
import { MenuPage } from './menu/MenuPage';
import { OrdersPage } from './orders/OrdersPage';
import { LoginPage } from './pages/LoginPage';

/**
 * Login, pedidos e cardápio.
 *
 * Configurações, clientes e relatórios entram como irmãos de /cardapio dentro
 * do <RequireAuth>, sem mexer em mais nada.
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
          <Route path="*" element={<Navigate to="/pedidos" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
