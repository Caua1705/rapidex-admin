import { describe, expect, it } from 'vitest';

import { MINIMO_DA_SENHA, validarTroca } from './change-password-form';

describe('validarTroca', () => {
  it('aceita a troca normal', () => {
    expect(validarTroca('TEMPORARIA123', 'minha senha nova', 'minha senha nova')).toEqual({});
  });

  it('cobra o mínimo do backend antes de gastar uma chamada', () => {
    const erros = validarTroca('atual12345678', 'curta', 'curta');
    expect(erros.nova).toBe(`Pelo menos ${MINIMO_DA_SENHA} caracteres.`);
  });

  it('recusa a senha nova IGUAL à atual — a regra que se esquece', () => {
    /*
     * Com uma senha temporária, repetir a que veio no papel deixaria valendo
     * uma credencial que atravessou WhatsApp, telefone e balcão — e
     * `must_change_password` sairia satisfeito, sem nada ter mudado.
     */
    expect(validarTroca('MesmaSenha123', 'MesmaSenha123', 'MesmaSenha123').nova).toMatch(
      /diferente da atual/i,
    );
  });

  it('recusa a confirmação que não confere', () => {
    expect(validarTroca('atual12345678', 'senha nova boa', 'senha nova bua').confirmacao).toMatch(
      /não conferem/i,
    );
  });

  it('não acusa a confirmação enquanto a senha nova está vazia', () => {
    /*
     * "As duas não conferem" com o campo de cima em branco acusa a pessoa de um
     * erro que ela ainda não cometeu — quem manda ali é "escolha a senha nova".
     */
    const erros = validarTroca('atual12345678', '', 'qualquer coisa');
    expect(erros.nova).toBeDefined();
    expect(erros.confirmacao).toBeUndefined();
  });

  it('cobra a senha atual, que é a única que a tela não consegue conferir', () => {
    // Só o bcrypt sabe se ela está certa; o que dá para exigir aqui é que ela
    // exista, para não mandar um corpo que o backend recusaria de qualquer jeito.
    expect(validarTroca('', 'senha nova boa', 'senha nova boa').atual).toBeDefined();
  });
});
