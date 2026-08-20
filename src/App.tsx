import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { CustomersPage } from './customers/CustomersPage';
import { KitchenPage } from './kitchen/KitchenPage';
import { AppShell } from './layout/AppShell';
import { PENDING_ENTRIES } from './layout/nav';
import { MenuPage } from './menu/MenuPage';
import { OrdersPage } from './orders/OrdersPage';
import { PerformancePage } from './performance/PerformancePage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { PedidosA } from './prototipo/PedidosA';
import { PedidosB } from './prototipo/PedidosB';
import { PedidosC } from './prototipo/PedidosC';
import { PrototipoIndex } from './prototipo/PrototipoIndex';
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
          <Route
            path="/clientes"
            element={
              <RequireAuth>
                <AppShell>
                  <CustomersPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/desempenho"
            element={
              <RequireAuth>
                <AppShell>
                  <PerformancePage />
                </AppShell>
              </RequireAuth>
            }
          />
          {/*
            MINHA LOJA É UM GRUPO DE ROTAS, uma por seção. A lista da esquerda
            é navegação de verdade — o endereço identifica a tela, o F5 volta
            onde estava e o botão voltar do navegador funciona entre seções.

            `index` redireciona para Operação: /minha-loja sozinha não é uma
            tela, é o nome do grupo. Deixá-la renderizar um estado vazio
            "escolha uma seção" seria uma tela a mais para atravessar toda vez.

            É Operação, e não mais Geral, porque é o estado do dia: quem abre
            Minha loja no meio do turno vem ver quais lojas estão no ar, não os
            padrões que encosta uma vez por mês.
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
            <Route index element={<Navigate to="operacao" replace />} />
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

          {/*
            OS PROTÓTIPOS DE DIREÇÃO VISUAL — três tratamentos da tela de
            Pedidos, existindo ao mesmo tempo para serem COMPARADOS.

            FORA DO <RequireAuth> E FORA DO <AppShell>, e as duas coisas são
            de propósito: cada direção desenha a PRÓPRIA navegação (é
            justamente uma das variáveis em julgamento), e exigir sessão
            transformaria "abrir o link e olhar" em "lembrar a senha". Nada
            aqui lê a API — o conteúdo é `prototipo/pedidos-exemplo.ts`.

            AO CONTRÁRIO DA GALERIA ACIMA, ELAS EXISTEM EM PRODUÇÃO: a decisão
            é tomada olhando o preview da Vercel, não o servidor de
            desenvolvimento de quem escreveu. Somem no dia em que a direção
            for escolhida — a pasta inteira sai junto.
          */}
          <Route path="/prototipo" element={<PrototipoIndex />} />
          <Route path="/prototipo/pedidos/a" element={<PedidosA />} />
          <Route path="/prototipo/pedidos/b" element={<PedidosB />} />
          <Route path="/prototipo/pedidos/c" element={<PedidosC />} />

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
