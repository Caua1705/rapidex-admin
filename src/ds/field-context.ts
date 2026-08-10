import { createContext, useContext } from 'react';

/**
 * O que um controle do design system precisa saber do `Field` em que está.
 *
 * Mora em arquivo próprio, e não dentro de `Field.tsx`, porque um arquivo que
 * exporta componente E gancho quebra o hot reload do Vite — a tela recarrega
 * inteira a cada tecla em vez de trocar só o componente.
 *
 * O CONTRATO: quem monta o campo (o `Field`) gera os ids e decide o estado;
 * quem desenha o controle (`Input`, `Select`, `Textarea`…) só lê. É o que
 * garante que rótulo, ajuda e erro fiquem ligados ao controle certo sem
 * nenhuma tela repetir `aria-describedby` à mão.
 */
export type FieldState = {
  /** id do controle — o rótulo aponta para cá. */
  controlId: string;
  /** Lista para o `aria-describedby` do controle (ajuda e/ou erro). */
  describedBy: string | undefined;
  invalid: boolean;
  disabled: boolean;
};

export const FieldContext = createContext<FieldState | null>(null);

export function useFieldState(): FieldState | null {
  return useContext(FieldContext);
}
