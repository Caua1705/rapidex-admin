import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { RequireAuth, ROTA_DA_TROCA_DE_SENHA } from './auth/RequireAuth';
import { SessionProvider } from './auth/SessionProvider';
import { CashbackPage } from './cashback/CashbackPage';
import { CouponsPage } from './coupons/CouponsPage';
import { CouriersPage } from './couriers/CouriersPage';
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
import { StoreIndexPage } from './store/StoreIndexPage';
import { StoreLayout } from './store/StoreLayout';
import { StoreSectionPage } from './store/StoreSectionPage';
import { STORE_SECTIONS } from './store/store-sections';
import { UsersPage } from './users/UsersPage';
import { UiGalleryPage } from './ui-gallery/UiGalleryPage';
import { WhatsAppPage } from './whatsapp/WhatsAppPage';

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
          {/*
            ENTREGADORES exige só a LEITURA (`GET /admin/couriers`, PESSOAS).
            Cadastrar, editar e excluir são da gerência e são decididos DENTRO
            da tela — pôr a guarda de escrita aqui trancaria a porta para o
            atendente, que é justamente quem precisa da lista para entregar o
            pedido ao motoboy que chegou. Mesma decisão de Cupons.
          */}
          <Route
            path="/entregadores"
            element={
              <RequireAuth acao="entregadores.ver">
                <AppShell>
                  <CouriersPage />
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
            LOJA É UM GRUPO DE ROTAS, uma por seção. A lista da esquerda é
            navegação de verdade — o endereço identifica a tela, o F5 volta
            onde estava e o botão voltar do navegador funciona entre seções.

            O QUE `index` RENDERIZA DEPENDE DA LARGURA, e é a única rota do
            painel assim. No desktop, /loja sozinha não é uma tela: é o nome do
            grupo, e a coluna de seções já está aberta ao lado — ela
            redireciona para Operação, que é o estado do dia. No telefone a
            coluna não cabe, /loja É a tela, e ela lista as nove seções. Ver
            `StoreIndexPage`, que é onde a decisão mora.

            É Operação, e não Geral, porque é o que se abre com pressa: quem
            abre Loja no meio do turno vem ver quais lojas estão no ar, não os
            padrões que encosta uma vez por mês.
          */}
          <Route
            path="/loja"
            element={
              <RequireAuth>
                <AppShell>
                  <StoreLayout />
                </AppShell>
              </RequireAuth>
            }
          >
            <Route index element={<StoreIndexPage />} />
            {STORE_SECTIONS.map((secao) => (
              <Route key={secao.id} path={secao.id} element={<StoreSectionPage id={secao.id} />} />
            ))}
          </Route>
          {/*
            O ENDEREÇO ANTIGO CONTINUA ABRINDO.

            `/minha-loja/horarios` é o link que o suporte manda por WhatsApp e
            que o lojista deixou nos favoritos — a própria `StoreLayout` cita
            isso como um dos ganhos de cada seção ser uma rota. Uma renomeação
            que quebra esses links troca um rótulo melhor por um beco, e o beco
            dura para sempre.

            O splat cobre as nove seções e a raiz de uma vez, e `replace` faz o
            endereço velho não ficar no histórico: quem voltar do navegador não
            cai num redirecionamento em laço.
          */}
          <Route path="/minha-loja/*" element={<LojaRenomeada />} />
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
          {/*
            WHATSAPP exige o papel da LEITURA (`GET /admin/whatsapp/channels`,
            GERENCIA), como Cupons e Cashback: conectar e desconectar são do
            dono e isso é decidido DENTRO da tela. Pôr a guarda de escrita aqui
            trancaria a porta justamente para quem mais precisa entrar — é o
            gerente que responde ao cliente que ligou dizendo não ter recebido
            o aviso do pedido.
          */}
          <Route
            path="/whatsapp"
            element={
              <RequireAuth acao="whatsapp.ver">
                <AppShell>
                  <WhatsAppPage />
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

/**
 * `/minha-loja/<seção>` → `/loja/<seção>`, preservando o resto do endereço.
 *
 * A troca é do PREFIXO e não do caminho inteiro porque as nove seções não
 * mudaram de nome — só o grupo mudou. Assim o redirecionamento não precisa
 * conhecer a lista de seções, e não envelhece quando uma nova entrar.
 *
 * `search` e `hash` vêm junto: um dia haverá link com âncora, e um
 * redirecionamento que come a query é a forma silenciosa de perder o filtro
 * que alguém mandou por mensagem.
 */
function LojaRenomeada() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace('/minha-loja', '/loja')}${search}${hash}`} replace />;
}
