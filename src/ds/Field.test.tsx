import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Field } from './Field';
import { Input } from './Input';
import { Textarea } from './Textarea';

/*
 * A LIGAÇÃO ENTRE RÓTULO, AJUDA, ERRO E CONTROLE.
 *
 * É a parte do formulário que mais some quando cada tela monta o seu à mão — e
 * é exatamente ela que o leitor de tela usa. Estes testes cobram o que o
 * `Field` promete entregar sem nenhuma tela repetir `aria-describedby`.
 */
describe('Field', () => {
  it('liga o rótulo ao controle', () => {
    render(
      <Field label="Valor mínimo do pedido">
        <Input value="20,00" onValueChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText('Valor mínimo do pedido')).toBeInTheDocument();
  });

  it('a ajuda entra na descrição do controle', () => {
    render(
      <Field label="Preço" hint="O que o cliente vê no cardápio.">
        <Input value="" onValueChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText('Preço')).toHaveAccessibleDescription(
      'O que o cliente vê no cardápio.',
    );
  });

  it('o erro marca o controle como inválido e é anunciado', () => {
    render(
      <Field label="Latitude" error="Precisa ficar entre -90 e 90.">
        <Input value="120" onValueChange={() => {}} />
      </Field>,
    );

    const campo = screen.getByLabelText('Latitude');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Precisa ficar entre -90 e 90.');
    // `role="alert"`: quem usa leitor de tela ouve o erro quando ele aparece.
    expect(screen.getByRole('alert')).toHaveTextContent('Precisa ficar entre -90 e 90.');
  });

  it('ajuda e erro convivem na mesma descrição', () => {
    render(
      <Field label="CEP" hint="Só os números." error="CEP não encontrado.">
        <Input value="00000" onValueChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText('CEP')).toHaveAccessibleDescription(
      'Só os números. CEP não encontrado.',
    );
  });

  /*
   * "Obrigatório" precisa ser uma PALAVRA. O asterisco é enfeite para quem lê a
   * tela e silêncio para quem a escuta.
   */
  it('obrigatório é dito por extenso para o leitor de tela', () => {
    render(
      <Field label="Nome da filial" required>
        <Input value="" onValueChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText(/Nome da filial.*obrigatório/s)).toBeInTheDocument();
  });

  it('o envelope desabilitado desabilita o controle de dentro', () => {
    render(
      <Field label="Taxa de entrega" disabled>
        <Input value="7,50" onValueChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText('Taxa de entrega')).toBeDisabled();
  });

  it('vale para a área de texto do mesmo jeito', () => {
    render(
      <Field label="Descrição" hint="Aparece embaixo do nome.">
        <Textarea value="" onValueChange={() => {}} />
      </Field>,
    );

    expect(screen.getByLabelText('Descrição')).toHaveAccessibleDescription(
      'Aparece embaixo do nome.',
    );
  });
});
