/**
 * Escolher numa lista do painel.
 *
 * O painel não tem mais nenhum `<select>` nativo, então `selectOption()` não
 * serve para nada: o seletor é um botão que abre uma lista `role="listbox"`
 * com `role="option"` dentro. Este arquivo existe para que a troca não fique
 * copiada em cinco specs — e para que a próxima mudança no componente tenha
 * um lugar só para arrumar.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { branchName } from '../src/layout/branch-heading';
import { FAKE_BRANCH, FAKE_BRANCH_2 } from './fake-api';

/** Abre o seletor e escolhe a opção pelo texto que aparece na tela. */
export async function escolher(gatilho: Locator, rotulo: string | RegExp) {
  await gatilho.click();
  await gatilho.page().getByRole('option', { name: rotulo, exact: true }).click();
  // Escolher fecha a lista e devolve o foco ao gatilho: sem esperar por isso,
  // o próximo clique do teste pode cair na lista que ainda está saindo.
  await expect(gatilho).toHaveAttribute('aria-expanded', 'false');
}

/** Os rótulos das opções abertas, na ordem em que aparecem. */
export async function opcoesDe(gatilho: Locator): Promise<string[]> {
  await gatilho.click();
  const rotulos = await gatilho.page().getByRole('option').allInnerTexts();
  await gatilho.press('Escape');
  return rotulos;
}

/**
 * O painel abre em "todas as filiais"; boa parte das telas exige uma escolhida.
 */
export async function escolherFilial(page: Page, branch = FAKE_BRANCH) {
  await escolher(page.getByTestId('branch-select'), branchName(branch));
}

export { FAKE_BRANCH, FAKE_BRANCH_2 };
