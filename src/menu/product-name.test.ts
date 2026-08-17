import { describe, expect, it } from 'vitest';

import { qualifiersByProduct, splitProductName } from './product-name';

describe('splitProductName', () => {
  it('separa o parêntese do fim do nome', () => {
    expect(splitProductName('Picanha Suína (400g)')).toEqual({
      base: 'Picanha Suína',
      qualifier: '400 g',
    });
  });

  // "1kg" e "1 kg" são a mesma coisa cadastrada de dois jeitos; na coluna elas
  // precisam ler igual, senão a variação parece outra.
  it('normaliza a medida colada ao número', () => {
    expect(splitProductName('Picanha Suína (1kg)').qualifier).toBe('1 kg');
    expect(splitProductName('Refrigerante (600 ML)').qualifier).toBe('600 ml');
    expect(splitProductName('Porção (500g)').qualifier).toBe('500 g');
  });

  // Fora da lista de unidades o texto sai como o lojista escreveu: "1 Kilo" não
  // é para virar "1 kilo" só porque casou com um número seguido de letras.
  it('o que não é unidade conhecida sai como está', () => {
    expect(splitProductName('Pizza (broto)').qualifier).toBe('broto');
    expect(splitProductName('Água (com gás)').qualifier).toBe('com gás');
  });

  it('nome sem parêntese não tem qualificador', () => {
    expect(splitProductName('X-Burger Clássico')).toEqual({
      base: 'X-Burger Clássico',
      qualifier: null,
    });
  });

  /*
   * O TETO DE 20 CARACTERES separa qualificador de observação. "(400g)"
   * distingue duas linhas; "(consulte os sabores do dia)" é texto de cardápio,
   * e arrancá-lo do nome esconderia informação em vez de organizá-la.
   */
  it('parêntese longo continua fazendo parte do nome', () => {
    const longo = 'Sorvete (consulte os sabores do dia)';
    expect(splitProductName(longo)).toEqual({ base: longo, qualifier: null });
  });

  it('parêntese no meio do nome não conta — só o do fim', () => {
    expect(splitProductName('Combo (2) para dois').qualifier).toBeNull();
  });

  it('nome que é só um parêntese continua inteiro', () => {
    expect(splitProductName('(promoção)')).toEqual({ base: '(promoção)', qualifier: null });
  });
});

describe('qualifiersByProduct', () => {
  /*
   * O PROBLEMA QUE ISTO RESOLVE é de varredura: três linhas com catorze
   * caracteres idênticos em semibold, e o que as separa no fim da string.
   */
  it('marca as variações quando a base se repete na lista', () => {
    const mapa = qualifiersByProduct([
      { id: 'a', name: 'Picanha Suína' },
      { id: 'b', name: 'Picanha Suína (400g)' },
      { id: 'c', name: 'Picanha Suína (1kg)' },
    ]);

    expect(mapa).toEqual({ b: '400 g', c: '1 kg' });
    // O item sem parêntese não ganha etiqueta inventada: o cadastro não diz de
    // que tamanho ele é, e a tela não vai adivinhar.
    expect(mapa.a).toBeUndefined();
  });

  /*
   * NOME QUE NÃO SE REPETE FICA INTEIRO. "Coca-Cola (lata)" sozinha numa
   * categoria já se distingue de "Guaraná" — partir o nome dela seria mostrar
   * um nome diferente do cadastrado sem nenhum problema a resolver.
   */
  it('base única não vira variação', () => {
    expect(
      qualifiersByProduct([
        { id: 'a', name: 'Coca-Cola (lata)' },
        { id: 'b', name: 'Guaraná' },
      ]),
    ).toEqual({});
  });

  it('a comparação da base ignora caixa e acento', () => {
    const mapa = qualifiersByProduct([
      { id: 'a', name: 'PICANHA SUINA (400g)' },
      { id: 'b', name: 'Picanha Suína (1kg)' },
    ]);
    expect(mapa).toEqual({ a: '400 g', b: '1 kg' });
  });

  it('lista vazia devolve mapa vazio', () => {
    expect(qualifiersByProduct([])).toEqual({});
  });
});
