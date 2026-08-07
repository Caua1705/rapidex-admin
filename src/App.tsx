import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { AppShell } from './layout/AppShell';
import { OrdersPage } from './orders/OrdersPage';
import { LoginPage } from './pages/LoginPage';

/**
 * Só duas rotas nesta entrega: login e pedidos.
 *
 * Cardápio, configurações, clientes e relatórios entram como irmãos de
 * /pedidos dentro do <RequireAuth>, sem mexer em mais nada.
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
          <Route path="*" element={<Navigate to="/pedidos" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
