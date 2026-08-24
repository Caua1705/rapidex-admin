import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { changePassword } from '../api/auth';
import { messageFromUnknownError } from '../api/errors';
import { useSession } from '../auth/session-context';
import { MINIMO_DA_SENHA, validarTroca } from './change-password-form';
import { Field, Input } from '../ds';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
import './ChangePasswordPage.css';

/**
 * ============================================================================
 * TROCAR A SENHA — a tela obrigatória e a voluntária, e são a mesma
 * ============================================================================
 *
 * Chega-se aqui por dois caminhos:
 *
 *   1. `must_change_password` — quem entrou com uma senha temporária. O painel
 *      inteiro está fechado para essa pessoa até ela trocar.
 *   2. "Trocar minha senha", no menu da conta. Qualquer um, a qualquer hora.
 *
 * UMA TELA SÓ, PORQUE É A MESMA COISA: os três campos, a mesma rota, a mesma
 * consequência. O que muda é a saída — no caminho 1 não há para onde voltar, e
 * é isso que separa as duas variantes aqui dentro.
 *
 * ----------------------------------------------------------------------------
 * FORA DO `<AppShell>`, e não é economia de código
 * ----------------------------------------------------------------------------
 *
 * É a mesma razão da Cozinha: com a senha temporária, `GET /admin/auth/me` e
 * este PATCH são as DUAS únicas rotas que respondem — todo o resto é 403.
 * Desenhar a lateral seria oferecer nove portas trancadas, e cada clique nelas
 * devolveria a pessoa para cá. A tela sem moldura diz a verdade: hoje só há
 * isto a fazer.
 *
 * ----------------------------------------------------------------------------
 * QUEM DECIDE É O CAMPO, NÃO O 403
 * ----------------------------------------------------------------------------
 *
 * O backend responde 403 (e não 401) de propósito: a identidade é conhecida, e
 * um 401 mandaria a pessoa para o login — que é onde ela não resolve nada,
 * porque ela já entrou. Mas o painel não espera o 403 para saber: o sinal é o
 * `must_change_password` que o login e o `/me` já devolvem, e ele é obedecido
 * em `RequireAuth`. O 403 é a rede embaixo.
 *
 * ----------------------------------------------------------------------------
 * TROCAR A SENHA DERRUBA A PRÓPRIA SESSÃO — e o relogin é daqui
 * ----------------------------------------------------------------------------
 *
 * `PATCH /admin/auth/password` grava `password_changed_at`, e isso REVOGA todo
 * token emitido antes — inclusive o desta aba. A resposta é uma mensagem, não
 * um token novo: a chamada seguinte seria 401, e o painel se fecharia sozinho
 * no instante seguinte a um sucesso.
 *
 * Por isso a tela refaz o login com a senha que a pessoa acabou de escolher. O
 * par está na mão (o e-mail vem da sessão), e um logout logo depois de "senha
 * alterada" se lê como falha, não como segurança. Se o relogin não passar, a
 * tela diz o que aconteceu e oferece o login — nunca fica num limbo em que a
 * senha mudou e ninguém contou.
 */
export function ChangePasswordPage() {
  const { user, signIn, signOut } = useSession();
  const navigate = useNavigate();

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [tentou, setTentou] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /* A senha mudou, e o relogin não passou. É o único estado em que a tela para
     de ser um formulário: insistir nos campos seria pedir de novo uma senha
     que já não é a atual. */
  const [precisaEntrarDeNovo, setPrecisaEntrarDeNovo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sem sessão não há senha própria a trocar: o caminho é o login.
  if (!user) return <Navigate to="/login" replace />;

  const obrigatoria = user.must_change_password;
  /* O e-mail é lido AQUI, e não dentro do `submeter`: `submeter` é uma
     declaração de função (içada), e o TypeScript não leva o estreitamento de
     `user` para dentro dela. Guardar o valor depois da guarda é mais honesto
     que um `!` — o `!` afirmaria o que a linha acima já provou, e continuaria
     afirmando no dia em que a guarda saísse. */
  const meuEmail = user.email;
  const erros = validarTroca(atual, nova, confirmacao);
  const mostrar = tentou ? erros : {};

  async function submeter(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);
    setErrorMessage(null);
    if (Object.keys(erros).length > 0) return;

    setSubmitting(true);
    try {
      await changePassword({
        current_password: atual,
        new_password: nova,
        confirm_password: confirmacao,
      });
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      setSubmitting(false);
      return;
    }

    /*
     * DAQUI PARA BAIXO A SENHA JÁ MUDOU. Nada abaixo desta linha pode ser
     * relatado como "não deu certo": o que falhar a partir daqui é o relogin, e
     * a pessoa precisa saber que a senha nova é a que vale.
     */
    try {
      await signIn(meuEmail, nova);
      navigate('/pedidos', { replace: true });
    } catch {
      setPrecisaEntrarDeNovo(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="troca">
      <div className="troca__theme">
        <ThemeToggle />
      </div>

      <div className="troca__box">
        <div className="troca__brand">
          <RapidexLogo size={32} />
        </div>

        {precisaEntrarDeNovo ? (
          <div className="troca__final" data-testid="troca-entrar-de-novo">
            <h1 className="t-section troca__titulo">Senha alterada</h1>
            <p className="t-body">
              Sua senha nova já está valendo. Trocar a senha encerra as sessões abertas — inclusive
              esta —, então entre de novo para continuar.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                signOut();
                navigate('/login', { replace: true });
              }}
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form className="troca__form" onSubmit={submeter} noValidate>
            <h1 className="t-section troca__titulo">
              {obrigatoria ? 'Escolha a sua senha' : 'Trocar minha senha'}
            </h1>

            {obrigatoria ? (
              <p className="t-body troca__intro" data-testid="troca-obrigatoria">
                Você entrou com uma senha temporária, que foi criada por outra pessoa e passada a
                você. Escolha a sua — a partir daí, ninguém mais a conhece, e o painel abre.
              </p>
            ) : (
              <p className="t-body troca__intro">
                Trocar a senha <strong>encerra as sessões abertas</strong>, inclusive nos outros
                computadores da loja. Você vai entrar de novo com a senha nova.
              </p>
            )}

            {errorMessage ? (
              <p className="alert alert--error" role="alert" data-testid="troca-erro">
                {errorMessage}
              </p>
            ) : null}

            <Field label="Senha atual" required error={mostrar.atual ?? null}>
              <Input
                type="password"
                name="current-password"
                autoComplete="current-password"
                autoFocus
                value={atual}
                onValueChange={setAtual}
                data-testid="troca-atual"
              />
            </Field>

            <Field
              label="Senha nova"
              required
              hint={`Pelo menos ${MINIMO_DA_SENHA} caracteres.`}
              error={mostrar.nova ?? null}
            >
              <Input
                type="password"
                name="new-password"
                autoComplete="new-password"
                value={nova}
                onValueChange={setNova}
                data-testid="troca-nova"
              />
            </Field>

            <Field label="Repita a senha nova" required error={mostrar.confirmacao ?? null}>
              <Input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmacao}
                onValueChange={setConfirmacao}
                data-testid="troca-confirmacao"
              />
            </Field>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={submitting}
              data-testid="troca-salvar"
            >
              {submitting ? 'Salvando…' : 'Salvar senha nova'}
            </button>

            {/*
              A SAÍDA DEPENDE DE HAVER PARA ONDE IR.
              Na troca obrigatória não há: o painel está fechado, e um "Cancelar"
              devolveria a pessoa para esta mesma tela. O que existe ali é sair
              da conta — que é uma saída de verdade, para quem entrou no lugar
              errado ou recebeu a senha de outra pessoa por engano.
            */}
            {obrigatoria ? (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => {
                  signOut();
                  navigate('/login', { replace: true });
                }}
                data-testid="troca-sair"
              >
                Sair da conta
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => navigate(-1)}
                data-testid="troca-cancelar"
              >
                Cancelar
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
