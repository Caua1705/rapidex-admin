import { describe, expect, it } from 'vitest';

import type { RestaurantProfile } from '../api/types';
import {
  DESCRICAO_MAX,
  draftDoPerfil,
  estadoDoTexto,
  NOTAS_MAX,
  problemaDoPerfil,
  profilePayload,
  textoGravavel,
  type ProfileDraft,
} from './restaurant-profile';

const PERFIL: RestaurantProfile = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Pizzaria Doze',
  slug: 'pizzaria-doze',
  description: 'Pizza de forno a lenha desde 2011.',
  assistant_notes: 'Pizzaria. Forno a lenha e rodízio às quintas.',
};

const texto = (n: number) => 'a'.repeat(n);

const draft = (over: Partial<ProfileDraft> = {}): ProfileDraft => ({
  descricao: PERFIL.description ?? '',
  notas: PERFIL.assistant_notes ?? '',
  ...over,
});

describe('o rascunho que sai da resposta', () => {
  it('nulo vira texto vazio: acima do restaurante não há de quem herdar', () => {
    expect(draftDoPerfil({ ...PERFIL, description: null, assistant_notes: null })).toEqual({
      descricao: '',
      notas: '',
    });
  });
});

describe('o corpo do PATCH', () => {
  it('nada mexido, nada a gravar', () => {
    expect(profilePayload(draft(), draft())).toBeNull();
  });

  it('leva SÓ o campo mexido', () => {
    const body = profilePayload(draft({ descricao: 'Outra vitrine.' }), draft());
    expect(body).toEqual({ description: 'Outra vitrine.' });
    expect(body).not.toHaveProperty('assistant_notes');
  });

  /*
   * A GARANTIA QUE SEGURA O TEXTO LEGADO.
   *
   * Um `assistant_notes` de 400 caracteres chega da Response (que não declara
   * teto). Se ele fosse junto no corpo por estar na tela, o PATCH inteiro
   * tomaria 422 e o lojista não conseguiria mais salvar a DESCRIÇÃO — um campo
   * que ele nunca deixou errado.
   */
  it('não reenvia o texto legado acima do teto que ninguém mexeu', () => {
    const original = draft({ notas: texto(400) });
    const body = profilePayload({ ...original, descricao: 'Nova vitrine.' }, original);

    expect(body).toEqual({ description: 'Nova vitrine.' });
    expect(body).not.toHaveProperty('assistant_notes');
    expect(problemaDoPerfil({ ...original, descricao: 'Nova vitrine.' }, original)).toBeNull();
  });

  it('vazio vira null, que APAGA — não é "volta a herdar"', () => {
    expect(profilePayload(draft({ notas: '   ' }), draft())).toEqual({ assistant_notes: null });
  });

  it('apara as pontas: é o texto aparado que o backend vai medir', () => {
    expect(profilePayload(draft({ descricao: '  Vitrine.  ' }), draft())).toEqual({
      description: 'Vitrine.',
    });
    expect(textoGravavel('  Vitrine.  ')).toBe('Vitrine.');
  });

  /*
   * Espaço no fim não é conteúdo. Contado como alteração, ele acenderia a barra
   * de salvar para gravar exatamente o que já está gravado.
   */
  it('espaço solto no fim não conta como alteração', () => {
    expect(profilePayload(draft({ descricao: `${PERFIL.description} ` }), draft())).toBeNull();
  });
});

describe('a contagem, que precisa prever o 422', () => {
  it('mede o texto APARADO, que é o que o backend recebe', () => {
    const estado = estadoDoTexto(`${texto(NOTAS_MAX)}   `, '', NOTAS_MAX);
    expect(estado.contagem).toBe(NOTAS_MAX);
    expect(estado.excedente).toBe(0);
    expect(estado.bloqueia).toBe(false);
  });

  it('passou do teto e foi mexido: bloqueia, com o número que falta cortar', () => {
    const estado = estadoDoTexto(texto(NOTAS_MAX + 12), '', NOTAS_MAX);
    expect(estado.excedente).toBe(12);
    expect(estado.bloqueia).toBe(true);
    expect(estado.legado).toBe(false);
  });

  it('passou do teto e NÃO foi mexido: é legado, e não bloqueia', () => {
    const legado = texto(NOTAS_MAX + 100);
    const estado = estadoDoTexto(legado, legado, NOTAS_MAX);
    expect(estado.legado).toBe(true);
    expect(estado.bloqueia).toBe(false);
    expect(estado.excedente).toBe(100);
  });

  it('mexer no legado sem chegar ao teto continua bloqueando', () => {
    const legado = texto(NOTAS_MAX + 100);
    const estado = estadoDoTexto(texto(NOTAS_MAX + 40), legado, NOTAS_MAX);
    expect(estado.bloqueia).toBe(true);
    expect(estado.legado).toBe(false);
  });
});

describe('a recusa antes do 422', () => {
  it('cala quando os dois cabem', () => {
    expect(problemaDoPerfil(draft({ descricao: texto(DESCRICAO_MAX) }), draft())).toBeNull();
  });

  it('nomeia o campo e diz quantos caracteres cortar', () => {
    expect(problemaDoPerfil(draft({ notas: texto(NOTAS_MAX + 1) }), draft())).toBe(
      'Anotações para o assistente: corte 1 caractere — o teto é 300.',
    );
    expect(problemaDoPerfil(draft({ descricao: texto(DESCRICAO_MAX + 112) }), draft())).toBe(
      'Descrição: corte 112 caracteres — o teto é 1000.',
    );
  });
});
