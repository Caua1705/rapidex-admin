import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createErrorReport } from '../api/error-reports';
import { ApiError } from '../api/errors';
import { ErrorBoundary } from './ErrorBoundary';
import { LOG_MAX } from './error-report';

vi.mock('../api/error-reports', () => ({ createErrorReport: vi.fn() }));

const criar = vi.mocked(createErrorReport);

/*
 * O React escreve a exceção capturada no console mesmo quando a borda a trata,
 * e o `jsdom` a imprime inteira em cada caso. Silenciar aqui é o único jeito de
 * a saída do `npm test` continuar legível — o que se testa não é o console.
 */
let consoleErro: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  criar.mockReset();
  consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErro.mockRestore();
});

/** Um componente que quebra no render — o caso que a borda existe para pegar. */
function Explode({ erro }: { erro?: unknown }): never {
  throw erro === undefined ? new TypeError('Cannot read properties of undefined') : erro;
}

describe('ErrorBoundary', () => {
  it('deixa passar quando nada quebra', () => {
    render(
      <ErrorBoundary escopo="tela">
        <p>o cardápio</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('o cardápio')).toBeInTheDocument();
    expect(screen.queryByTestId('erro-da-tela')).not.toBeInTheDocument();
  });

  /*
   * O DEFEITO DE ORIGEM, e ele é o motivo deste arquivo existir: antes desta
   * rodada não havia borda nenhuma, e uma exceção de render dava TELA BRANCA —
   * sem mensagem, sem "recarregar", e sem nada chegando ao suporte.
   */
  it('troca a tela branca por uma tela com saída', () => {
    render(
      <ErrorBoundary escopo="tela">
        <Explode />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('erro-da-tela')).toBeInTheDocument();
    expect(screen.getByTestId('erro-recarregar')).toBeInTheDocument();
    expect(screen.getByTestId('erro-ir-para-pedidos')).toBeInTheDocument();
  });

  /*
   * `throw null` existe em código de terceiro, e com o sinalizador deduzido do
   * erro (`error !== null`) a borda voltaria a desenhar os filhos no render
   * seguinte — que lançariam de novo. A tela branca de volta, agora piscando.
   */
  it('aguenta `throw null` sem voltar a desenhar o que quebrou', () => {
    render(
      <ErrorBoundary escopo="tela">
        <Explode erro={null} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('erro-da-tela')).toBeInTheDocument();
  });

  /* Na raiz não há moldura, e o texto muda: não há "outras seções" de pé. */
  it('fala diferente na raiz e dentro da moldura', () => {
    const { unmount } = render(
      <ErrorBoundary escopo="painel">
        <Explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText('O painel parou de funcionar')).toBeInTheDocument();
    // Sem moldura não há para onde ir sem recarregar.
    expect(screen.queryByTestId('erro-ir-para-pedidos')).not.toBeInTheDocument();
    unmount();

    render(
      <ErrorBoundary escopo="tela">
        <Explode />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Esta tela parou de funcionar')).toBeInTheDocument();
  });
});

describe('ErroDaTela · o relato', () => {
  it('trava o envio enquanto a história não foi escrita', async () => {
    render(
      <ErrorBoundary escopo="tela">
        <Explode />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('erro-enviar')).toBeDisabled();
    await userEvent.type(screen.getByTestId('erro-descricao'), 'a');
    expect(screen.getByTestId('erro-enviar')).toBeEnabled();
  });

  /*
   * O QUE VAI JUNTO SEM NINGUÉM DIGITAR é o ponto todo desta tela: o lojista
   * escreve a história, e o log e a tela vão sozinhos. Um relato que dependesse
   * de a pessoa copiar o traceback é um relato que nunca chega.
   */
  it('manda a história, o log e a tela — e o log traz o erro e os componentes', async () => {
    criar.mockResolvedValue({ id: 'rel-9f2c', created_at: '2026-09-02T03:00:00Z' });

    render(
      <ErrorBoundary escopo="tela">
        <Explode />
      </ErrorBoundary>,
    );

    await userEvent.type(screen.getByTestId('erro-descricao'), 'cliquei em salvar e sumiu tudo');
    await userEvent.click(screen.getByTestId('erro-enviar'));

    expect(criar).toHaveBeenCalledTimes(1);
    const corpo = criar.mock.calls[0]?.[0];
    expect(corpo?.description).toBe('cliquei em salvar e sumiu tudo');
    expect(corpo?.error_log).toContain('Cannot read properties of undefined');
    expect(corpo?.error_log).toContain('Explode');
    expect(corpo?.error_log?.length ?? 0).toBeLessThanOrEqual(LOG_MAX);
    // `screen` é o caminho da URL. No jsdom ele é "/".
    expect(corpo?.screen).toBe('/');

    // O número do relato é o que a pessoa repete para o suporte.
    expect(await screen.findByTestId('erro-protocolo')).toHaveTextContent('rel-9f2c');
  });

  /*
   * O PIOR CASO: o painel quebrou e a internet pode ter caído junto, ou a
   * sessão expirou. Engolir a falha deixaria a pessoa sem nada — e "não deu
   * para relatar o erro" numa tela de erro é onde a confiança acaba.
   */
  it('quando o envio falha, mostra o log para copiar e deixa tentar de novo', async () => {
    criar.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));

    render(
      <ErrorBoundary escopo="tela">
        <Explode />
      </ErrorBoundary>,
    );

    await userEvent.type(screen.getByTestId('erro-descricao'), 'sumiu tudo');
    await userEvent.click(screen.getByTestId('erro-enviar'));

    const falha = await screen.findByTestId('erro-falha-do-envio');
    expect(falha).toHaveTextContent('Sem conexão com o servidor.');
    // O log fica na tela, selecionável, para ir pelo WhatsApp.
    expect(falha).toHaveTextContent('Cannot read properties of undefined');
    expect(screen.getByTestId('erro-enviar')).toHaveTextContent('Tentar enviar de novo');
    expect(screen.queryByTestId('erro-protocolo')).not.toBeInTheDocument();
  });
});
