import { useEffect, type RefObject } from 'react';

/**
 * Prende o foco dentro de um contêiner e o devolve ao sair.
 *
 *   const caixa = useRef<HTMLDivElement>(null);
 *   useFocusTrap(caixa, open, onClose);
 *
 * O QUE ELE RESOLVE (WCAG 2.1.2, "sem armadilha de teclado" — pelo avesso):
 * quando uma folha ou um diálogo cobre a tela, o Tab NÃO pode continuar
 * andando pelo conteúdo de baixo. Quem usa teclado sai da caixa sem perceber,
 * fica navegando em algo que não está vendo e não acha o botão de fechar.
 *
 * O que ele faz, em ordem:
 *   1. guarda quem tinha o foco antes de abrir;
 *   2. joga o foco para o primeiro elemento focável de dentro;
 *   3. faz o Tab circular dentro da caixa (e o Shift+Tab, ao contrário);
 *   4. fecha no Esc;
 *   5. DEVOLVE o foco a quem o tinha, ao fechar — sem isto, quem fechou a
 *      caixa é largado no começo do documento.
 */
const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const caixa = ref.current;
    if (!caixa) return;

    const anterior = document.activeElement as HTMLElement | null;

    const focaveis = () => Array.from(caixa.querySelectorAll<HTMLElement>(FOCAVEIS));
    // O primeiro elemento focável, ou a própria caixa se ela não tiver nenhum.
    (focaveis()[0] ?? caixa).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const lista = focaveis();
      if (lista.length === 0) {
        event.preventDefault();
        return;
      }

      const primeiro = lista[0] as HTMLElement;
      const ultimo = lista[lista.length - 1] as HTMLElement;
      const atual = document.activeElement;

      if (event.shiftKey && (atual === primeiro || atual === caixa)) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && atual === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // `isConnected`: se quem abriu a caixa saiu da tela junto, não há para
      // onde devolver — e chamar focus() num nó solto não faz nada de útil.
      if (anterior?.isConnected) anterior.focus();
    };
  }, [ref, active, onClose]);
}
