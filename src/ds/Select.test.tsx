import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Select, type SelectOption } from './Select';

/*
 * O CONTRATO DE TECLADO DO SELETOR.
 *
 * Trocar o `<select>` nativo por um botão com lista custa exatamente isto: o
 * teclado deixa de vir de graça e passa a ser código nosso. Estes testes são o
 * que impede a troca de sair mais cara do que parecia — sem eles, a regressão
 * aparece na mão de quem depende do teclado, e não aqui.
 */
const OPCOES: SelectOption[] = [
  { value: 'chapa', label: 'Chapa' },
  { value: 'bar', label: 'Bar', disabled: true },
  { value: 'forno', label: 'Forno' },
];

function Palco({ inicial = '' }: { inicial?: string }) {
  const [value, setValue] = useState(inicial);
  return <Select value={value} onChange={setValue} options={OPCOES} aria-label="Setor" />;
}

describe('Select', () => {
  it('abre a lista e anuncia o estado no gatilho', async () => {
    render(<Palco />);
    const gatilho = screen.getByRole('button', { name: 'Setor' });

    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    expect(gatilho).toHaveAttribute('aria-haspopup', 'listbox');

    await userEvent.click(gatilho);

    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('a seta para baixo abre a lista sem clique', async () => {
    render(<Palco />);
    screen.getByRole('button', { name: 'Setor' }).focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('as setas andam pelas opções e pulam a desabilitada', async () => {
    render(<Palco />);
    await userEvent.click(screen.getByRole('button', { name: 'Setor' }));

    // Abre com o foco na primeira.
    expect(screen.getByRole('option', { name: 'Chapa' })).toHaveFocus();

    // "Bar" está desabilitada: a seta pula direto para "Forno".
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Forno' })).toHaveFocus();
  });

  it('Enter escolhe, fecha e devolve o foco ao gatilho', async () => {
    render(<Palco />);
    const gatilho = screen.getByRole('button', { name: 'Setor' });

    await userEvent.click(gatilho);
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(gatilho).toHaveTextContent('Forno');
    // Sem isto, quem escolheu pelo teclado é largado no fim do documento.
    expect(gatilho).toHaveFocus();
  });

  it('Esc fecha sem escolher e devolve o foco', async () => {
    render(<Palco inicial="chapa" />);
    const gatilho = screen.getByRole('button', { name: 'Setor' });

    await userEvent.click(gatilho);
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(gatilho).toHaveTextContent('Chapa');
    expect(gatilho).toHaveFocus();
  });

  it('a opção escolhida é anunciada como selecionada', async () => {
    render(<Palco inicial="forno" />);
    await userEvent.click(screen.getByRole('button', { name: 'Setor' }));

    expect(screen.getByRole('option', { name: 'Forno' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Chapa' })).toHaveAttribute('aria-selected', 'false');
  });

  it('opção desabilitada não é escolhível pelo clique', async () => {
    render(<Palco inicial="chapa" />);
    const gatilho = screen.getByRole('button', { name: 'Setor' });

    await userEvent.click(gatilho);
    await userEvent.click(screen.getByRole('option', { name: 'Bar' }));

    // A lista continua aberta e o valor não mudou.
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(gatilho).toHaveTextContent('Chapa');
  });

  it('ocupado não abre e se declara ocupado', async () => {
    render(<Select value="" onChange={() => {}} options={OPCOES} aria-label="Setor" loading />);
    const gatilho = screen.getByRole('button', { name: 'Setor' });

    expect(gatilho).toHaveAttribute('aria-busy', 'true');
    expect(gatilho).toBeDisabled();

    await userEvent.click(gatilho);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
