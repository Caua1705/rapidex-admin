import { describe, expect, it } from 'vitest';

import { advanceActionFor, exitActionFor } from './order-actions';

const entrega = (status: string) => ({ status, order_type: 'delivery' });
const retirada = (status: string) => ({ status, order_type: 'takeaway' });

describe('o avanço do pedido', () => {
  it('é UM por estágio, e é o próximo passo do turno', () => {
    expect(advanceActionFor(entrega('pending'))?.target).toBe('accepted');
    expect(advanceActionFor(entrega('accepted'))?.target).toBe('preparing');
    expect(advanceActionFor(entrega('preparing'))?.target).toBe('ready');
    expect(advanceActionFor(entrega('out_for_delivery'))?.target).toBe('completed');
  });

  /*
   * De "Pronto" a máquina de estados aceita dois caminhos para frente, e quem
   * escolhe é a MODALIDADE. Oferecer os dois deixava um botão permanentemente
   * travado ao lado do bom, e a razão dele não muda durante o turno.
   */
  it('de "pronto", separa entrega de retirada', () => {
    expect(advanceActionFor(entrega('ready'))?.target).toBe('out_for_delivery');
    expect(advanceActionFor(retirada('ready'))?.target).toBe('completed');
  });

  it('não existe em estado final nem em status desconhecido', () => {
    expect(advanceActionFor(entrega('completed'))).toBeNull();
    expect(advanceActionFor(entrega('cancelled'))).toBeNull();
    expect(advanceActionFor(entrega('rejected'))).toBeNull();
    // Backend novo, painel velho: não se inventa um caminho adiante.
    expect(advanceActionFor(entrega('reticketed'))).toBeNull();
  });

  it('fala por verbo, e nunca pelo nome do estado de destino', () => {
    // "Aceito" era o rótulo, e é a mesma palavra do chip que diz onde o pedido
    // JÁ está — travado pelo Pix, ele lia como "já foi aceito".
    expect(advanceActionFor(entrega('pending'))?.label).toBe('Aceitar pedido');
    expect(advanceActionFor(entrega('preparing'))?.label).toBe('Marcar como pronto');
  });
});

describe('a saída do pedido', () => {
  /*
   * ANTES DE ACEITAR SE RECUSA, DEPOIS SE CANCELA. As duas rotas existem no
   * backend para um pedido pendente, e na tela elas eram dois botões vermelhos
   * lado a lado dizendo a mesma coisa.
   */
  it('em pendente é recusar — para todo mundo, e sem cancelar junto', () => {
    expect(exitActionFor(entrega('pending'), false)?.target).toBe('rejected');
    expect(exitActionFor(entrega('pending'), true)?.target).toBe('rejected');
  });

  it('depois de aceito é cancelar, e só para quem pode', () => {
    expect(exitActionFor(entrega('accepted'), true)?.target).toBe('cancelled');
    expect(exitActionFor(entrega('preparing'), true)?.target).toBe('cancelled');
    expect(exitActionFor(entrega('out_for_delivery'), true)?.target).toBe('cancelled');

    // Cancelar é rota própria e é da gerência: para o balcão o botão SOME.
    expect(exitActionFor(entrega('accepted'), false)).toBeNull();
  });

  it('não existe em estado final', () => {
    expect(exitActionFor(entrega('completed'), true)).toBeNull();
    expect(exitActionFor(entrega('cancelled'), true)).toBeNull();
    expect(exitActionFor(entrega('rejected'), true)).toBeNull();
  });

  /*
   * As duas apagam pedido e não têm desfazer. Recusar não pedia confirmação
   * nenhuma, e ficava colado no botão que o lojista aperta cinquenta vezes por
   * turno.
   */
  it('sempre pede confirmação', () => {
    expect(exitActionFor(entrega('pending'), true)?.confirm).toBe('recusar');
    expect(exitActionFor(entrega('preparing'), true)?.confirm).toBe('cancelar');
  });

  it('o avanço, esse, vai direto — avançar o pedido tem volta', () => {
    expect(advanceActionFor(entrega('pending'))?.confirm).toBeNull();
  });
});
