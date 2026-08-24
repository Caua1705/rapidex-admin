import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { RequireAuth, ROTA_DA_TROCA_DE_SENHA } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { CashbackPage } from './cashback/CashbackPage';
import { CouponsPage } from './coupons/CouponsPage';
import { CustomersPage } from './customers/CustomersPage';
import { KitchenPage } from './kitchen/KitchenPage';
import { AppShell } from './layout/AppShell';
import { PENDING_ENTRIES } from './layout/nav';
import { MenuPage } from './menu/MenuPage';
import { OrdersPage } from './orders/OrdersPage';
import { PerformancePage } from './performance/PerformancePage';
import { ReviewsPage } from './reviews/ReviewsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { LoginPage } from './pages/LoginPage';
import { StoreLayout } from './store/StoreLayout';
import { StoreSectionPage } from './store/StoreSectionPage';
import { STORE_SECTIONS } from './store/store-sections';
import { UsersPage } from './users/UsersPage';
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

          {/*
            A TROCA DE SENHA FICA FORA DO <AppShell>, como a Cozinha — e por um
            motivo mais forte que o dela: quem chega aqui por
            `must_change_password` tem DUAS rotas respondendo no backend
            inteiro. Uma lateral com nove destinos seria nove portas trancadas,
            e cada clique devolveria a pessoa para esta mesma tela.

            Ela continua dentro do <RequireAuth>: trocar a própria senha exige
            saber quem é você. É a única rota autenticada que a guarda de senha
            temporária NÃO redireciona — senão ela redirecionaria para si mesma.
          */}
          <Route
            path={ROTA_DA_TROCA_DE_SENHA}
            element={
              <RequireAuth>
                <ChangePasswordPage />
              </RequireAuth>
            }
          />
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
              <RequireAuth acao="clientes.ver">
                <AppShell>
                  <CustomersPage />
                </AppShell>
              </RequireAuth>
            }
          />
          <Route
            path="/desempenho"
            element={
              <RequireAuth acao="desempenho.ver">
                <AppShell>
                  <PerformancePage />
                </AppShell>
              </RequireAuth>
            }
          />
          {/*
            CASHBACK exige o papel da LEITURA (`GET /admin/cashback-rules`,
            GERENCIA). Escrever é do dono, e isso é decidido DENTRO da tela: o
            gerente entra, lê os números e não vê a barra de salvar. Pôr a
            guarda de escrita aqui trancaria a porta para quem o backend deixa
            entrar.
          */}
          <Route
            path="/cashback"
            element={
              <RequireAuth acao="cashback.ver">
                <AppShell>
                  <CashbackPage />
                </AppShell>
              </RequireAuth>
            }
          />
          {/*
            CUPONS exige o papel da LEITURA (`GET /admin/coupons`, GERENCIA),
            como Cashback: criar e editar são do dono, e isso é decidido DENTRO
            da tela — o gerente entra, lê quais campanhas estão no ar para
            responder ao cliente que ligou, e não vê "Nova campanha" nem o
            lápis. Pôr a guarda de escrita aqui trancaria a porta para quem o
            backend deixa entrar.
          */}
          <Route
            path="/cupons"
            element={
              <RequireAuth acao="cupons.ver">
                <AppShell>
                  <CouponsPage />
                </AppShell>
              </RequireAuth>
            }
          />
          {/*
            AVALIAÇÕES exige o mesmo papel da rota que ela consome
            (`GET /admin/reviews`, GERENCIA). O atendente não chega aqui nem
            digitando o endereço — sem a guarda, ele cairia numa tela que
            responde 403 e leria isso como defeito.
          */}
          <Route
            path="/avaliacoes"
            element={
              <RequireAuth acao="avaliacoes.ver">
                <AppShell>
                  <ReviewsPage />
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
          {/*
            USUÁRIOS exige o papel da LEITURA (`GET /admin/users`,
            SOMENTE_DONO) — e aqui, ao contrário de Cupons e Cashback, não há
            assimetria a respeitar dentro da tela: as quatro rotas são do dono.
            A rota devolve o e-mail de todo mundo da casa, que é metade da
            credencial de cada pessoa; não há meio-termo a dar ao gerente.
          */}
          <Route
            path="/usuarios"
            element={
              <RequireAuth acao="usuarios.ver">
                <AppShell>
                  <UsersPage />
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
