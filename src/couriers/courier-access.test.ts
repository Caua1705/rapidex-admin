import { describe, expect, it } from 'vitest';

import {
  linkDoEntregador,
  mensagemDoAcesso,
  podeGerarAcesso,
  urlDoWhatsApp,
} from './courier-access';

const APP = 'https://pederapidex.com';

/*
 * ============================================================================
 * O LINK SÓ EXISTE SE O DOMÍNIO DO APP EXISTIR
 * ============================================================================
 *
 * `VITE_COURIER_APP_URL` não tem valor padrão, e a decisão é do dono: se ela
 * faltar num ambiente, é melhor o botão NÃO APARECER do que gerar um link para
 * um domínio errado e o motoboy receber algo que não abre.
 *
 * Um padrão embutido aqui seria exatamente o defeito que a ausência da variável
 * existe para impedir — e ele apareceria em produção, uma vez, no dia do
 * primeiro entregador.
 */
describe('linkDoEntregador', () => {
  it('monta o endereço do app com o token', () => {
    expect(linkDoEntregador(APP, 'tok-123')).toBe('https://pederapidex.com/entregador/tok-123');
  });

  it('a barra sobrando no fim não vira barra dupla', () => {
    expect(linkDoEntregador('https://pederapidex.com/', 'tok-123')).toBe(
      'https://pederapidex.com/entregador/tok-123',
    );
  });

  it('sem domínio configurado, não há link — e não se inventa um', () => {
    expect(linkDoEntregador('', 'tok-123')).toBeNull();
    expect(linkDoEntregador(undefined, 'tok-123')).toBeNull();
  });

  it('o token vai codificado: ele entra num caminho de URL', () => {
    expect(linkDoEntregador(APP, 'a/b')).toBe('https://pederapidex.com/entregador/a%2Fb');
  });
});

describe('podeGerarAcesso', () => {
  it('sem o domínio do app, o botão não existe', () => {
    expect(podeGerarAcesso('')).toBe(false);
  });

  it('com o domínio, existe', () => {
    expect(podeGerarAcesso(APP)).toBe(true);
  });
});

/*
 * ============================================================================
 * A MENSAGEM PRONTA — o par inteiro, porque um sem o outro não abre nada
 * ============================================================================
 */
describe('mensagemDoAcesso', () => {
  const texto = mensagemDoAcesso({
    nomeDaLoja: 'Pizzaria do Zé',
    link: 'https://pederapidex.com/entregador/tok-123',
    codigo: 'K7M2P',
  });

  it('leva o link E o código: um sem o outro não entra', () => {
    expect(texto).toContain('https://pederapidex.com/entregador/tok-123');
    expect(texto).toContain('K7M2P');
  });

  it('diz de qual loja é, porque quem entrega serve mais de uma', () => {
    expect(texto).toContain('Pizzaria do Zé');
  });

  it('avisa que o código é pedido uma vez só', () => {
    expect(texto.toLowerCase()).toContain('uma vez');
  });
});

/*
 * ============================================================================
 * O WHATSAPP É UM LINK, E NADA ALÉM DISSO
 * ============================================================================
 *
 * `wa.me` com o telefone e o texto na querystring. Não há API, não há Business
 * Manager, não há token — e é por isso que este botão pode existir hoje,
 * enquanto a integração de WhatsApp do painel inteiro ainda é "em breve".
 */
describe('urlDoWhatsApp', () => {
  it('o telefone vai com o código do país e só dígitos', () => {
    const url = urlDoWhatsApp('(85) 99999-0000', 'olá');
    expect(url).toContain('https://wa.me/5585999990000');
  });

  it('não duplica o 55 de quem já o tem', () => {
    expect(urlDoWhatsApp('5585999990000', 'olá')).toContain('https://wa.me/5585999990000');
  });

  /*
   * O TEXTO VAI CODIFICADO. A mensagem tem quebra de linha e dois-pontos; sem
   * `encodeURIComponent` ela chegaria truncada no primeiro caractere especial —
   * e o motoboy receberia o link sem o código.
   */
  it('a mensagem é codificada para a querystring', () => {
    const url = urlDoWhatsApp('85999990000', 'linha 1\nlinha 2');
    expect(url).toContain('text=linha%201%0Alinha%202');
  });
});
