import { useCallback, useEffect, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import type { AdminUserCreated, AdminUserDetail } from '../api/types';
import {
  createAdminUser,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from '../api/users';
import { bodyDeCriacao, bodyDeEdicao, type UserDraft } from './users-model';

/**
 * A equipe do restaurante, e as três escritas que mexem nela.
 *
 * UMA LISTA SÓ, SEM RECORTE E SEM PAGINAÇÃO: `GET /admin/users` não aceita
 * query nenhuma. O que a tela filtra, ela filtra sobre o que já está na mão — e
 * é isso que permite contar os donos ativos aqui dentro sem uma segunda
 * chamada (ver `donosAtivos` em `users-model.ts`).
 *
 * AS ESCRITAS DEVOLVEM A FICHA GRAVADA, e é ela que entra no lugar da antiga.
 * Recarregar a lista inteira a cada clique faria a tela piscar e reordenar
 * debaixo do dedo de quem acabou de mexer numa linha — e a ordem é de cadastro,
 * então quem for editado hoje não muda de lugar.
 */
export function useUsers() {
  const [usuarios, setUsuarios] = useState<AdminUserDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setUsuarios(await listAdminUsers());
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      setUsuarios([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Põe a ficha gravada no lugar da antiga, ou no fim se for gente nova. */
  const guardar = useCallback((gravado: AdminUserDetail) => {
    setUsuarios((atuais) => {
      const existe = atuais.some((usuario) => usuario.id === gravado.id);
      return existe
        ? atuais.map((usuario) => (usuario.id === gravado.id ? gravado : usuario))
        : [...atuais, gravado];
    });
  }, []);

  /**
   * Cadastra alguém. Devolve a resposta INTEIRA, com a senha em claro.
   *
   * A senha não fica guardada aqui e não entra em estado nenhum deste hook: ela
   * atravessa direto para quem chamou, que a põe no diálogo. Um `useState` com
   * ela dentro seria um valor sensível sobrevivendo a fechamentos de diálogo,
   * trocas de aba e re-renderizações — sem nenhum leitor.
   */
  const criar = useCallback(
    async (draft: UserDraft): Promise<{ criado: AdminUserCreated } | { erro: unknown }> => {
      setIsSaving(true);
      try {
        const resposta = await createAdminUser(bodyDeCriacao(draft));
        guardar(resposta.admin_user);
        return { criado: resposta };
      } catch (error) {
        /* O ERRO SOBE CRU, e não como frase pronta: quem chama é o formulário,
           e o que ele precisa saber não é "falhou" — é QUAL CAMPO destacar. O
           409 de e-mail repetido é o erro mais provável desta tela, e ele tem
           campo. Ver `errosDoUsuario` em `users-model.ts`. */
        return { erro: error };
      } finally {
        setIsSaving(false);
      }
    },
    [guardar],
  );

  /**
   * Edita — e não chama nada quando nada mudou.
   *
   * `bodyDeEdicao` devolve `null` nesse caso, e o `null` vira sucesso silencioso
   * em vez de um PATCH vazio: o backend aceitaria `{}` e devolveria a mesma
   * ficha, e a tela teria gasto uma ida para não mudar coisa nenhuma.
   */
  const editar = useCallback(
    async (draft: UserDraft, original: AdminUserDetail): Promise<{ erro: unknown } | null> => {
      const body = bodyDeEdicao(draft, original);
      if (!body) return null;

      setIsSaving(true);
      try {
        guardar(await updateAdminUser(original.id, body));
        return null;
      } catch (error) {
        /* Embrulhado, e não solto: `unknown | null` colapsa para `unknown` no
           TypeScript, e quem chamasse perderia a distinção entre "gravou" e
           "falhou com um erro que por acaso é nulo". */
        return { erro: error };
      } finally {
        setIsSaving(false);
      }
    },
    [guardar],
  );

  /**
   * Desativa ou reativa pela própria linha — CORPO DE UM CAMPO SÓ.
   *
   * É a ação mais frequente da tela depois do cadastro ("fulano saiu hoje"), e
   * ela não pode carregar nome, papel e filial junto: reenviar o objeto inteiro
   * é desfazer o que outra aba acabou de gravar. Mesma decisão do interruptor
   * de campanha em Cupons.
   *
   * QUEM DECIDE SE O BOTÃO EXISTE NÃO É ESTA FUNÇÃO, e sim
   * `motivoParaNaoDesativar` na tela: as três recusas do backend são 400, e um
   * botão que só falha no clique é o que esta frente existe para acabar.
   */
  const alternarAtivo = useCallback(
    async (usuario: AdminUserDetail): Promise<string | null> => {
      setIsSaving(true);
      try {
        guardar(await updateAdminUser(usuario.id, { is_active: !usuario.is_active }));
        return null;
      } catch (error) {
        return messageFromUnknownError(error);
      } finally {
        setIsSaving(false);
      }
    },
    [guardar],
  );

  /**
   * Segunda via da senha. Devolve a resposta inteira, como `criar`.
   *
   * A ficha volta com `must_change_password` ligado de novo, e é por isso que
   * ela é guardada: a linha passa a dizer "senha temporária" na hora, que é o
   * estado verdadeiro daquela conta a partir deste instante.
   */
  const redefinirSenha = useCallback(
    async (usuario: AdminUserDetail): Promise<{ criado: AdminUserCreated } | { erro: string }> => {
      setIsSaving(true);
      try {
        const resposta = await resetAdminUserPassword(usuario.id);
        guardar(resposta.admin_user);
        return { criado: resposta };
      } catch (error) {
        return { erro: messageFromUnknownError(error) };
      } finally {
        setIsSaving(false);
      }
    },
    [guardar],
  );

  return {
    usuarios,
    isLoading,
    isSaving,
    errorMessage,
    criar,
    editar,
    alternarAtivo,
    redefinirSenha,
    recarregar: carregar,
  };
}
