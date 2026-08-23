import { useCallback, useEffect, useState } from 'react';

import { createCoupon, listCouponTemplates, listCoupons, updateCoupon } from '../api/coupons';
import { messageFromUnknownError } from '../api/errors';
import type { Coupon, CouponTemplate } from '../api/types';
import { bodyFrom, type CouponDraft } from './coupon-model';
import { errosDaResposta, type ErrosDoCupom } from './coupon-form';

/**
 * AS CAMPANHAS E O CATÁLOGO DE ARTE, que a tela sempre precisa juntos.
 *
 * As duas listas são carregadas na mesma ida, e não sob demanda, porque nenhuma
 * das duas responde sozinha a nada que a tela mostre: a linha da lista precisa
 * da arte para desenhar a imagem, e o seletor precisa das campanhas para
 * esconder as artes já usadas. Carregar o catálogo só ao abrir o diálogo faria
 * a lista abrir com um quadrado vazio no lugar de cada arte.
 *
 * NÃO HÁ RECORTE DE FILIAL EM LUGAR NENHUM: cupom é do restaurante inteiro.
 * O seletor do cabeçalho não pega nesta tela, e é a própria tela que diz isso
 * por escrito, em vez de deixar o lojista supor.
 */
export function useCoupons() {
  const [cupons, setCupons] = useState<Coupon[]>([]);
  const [artes, setArtes] = useState<CouponTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [campanhas, catalogo] = await Promise.all([listCoupons(), listCouponTemplates()]);
      setCupons(campanhas);
      setArtes(catalogo);
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      setCupons([]);
      setArtes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Põe a campanha gravada no lugar da antiga, ou no topo se for nova. */
  const guardar = useCallback((gravado: Coupon) => {
    setCupons((atuais) => {
      const existe = atuais.some((cupom) => cupom.id === gravado.id);
      return existe
        ? atuais.map((cupom) => (cupom.id === gravado.id ? gravado : cupom))
        : [gravado, ...atuais];
    });
  }, []);

  /**
   * Cria ou edita — o corpo COMPLETO, montado com a arte na mão.
   *
   * Devolve `null` quando gravou e o mapa de erros quando não: quem chama é o
   * diálogo, e o que ele precisa saber não é "falhou", é QUAL CAMPO destacar.
   * Uma mensagem única no rodapé faria o lojista reler doze campos atrás do que
   * o backend já disse.
   */
  const salvar = useCallback(
    async (rascunho: CouponDraft, arte: CouponTemplate): Promise<ErrosDoCupom | null> => {
      const body = bodyFrom(rascunho, arte);
      if (!body) {
        return {
          campos: { templateId: 'Esta arte não é aceita pelo painel. Escolha outra.' },
          geral: null,
        };
      }

      setIsSaving(true);
      try {
        const gravado = rascunho.id
          ? await updateCoupon(rascunho.id, body)
          : await createCoupon(body);
        guardar(gravado);
        return null;
      } catch (error) {
        return errosDaResposta(error);
      } finally {
        setIsSaving(false);
      }
    },
    [guardar],
  );

  /**
   * Liga e desliga a campanha da própria linha — CORPO DE UM CAMPO SÓ.
   *
   * Aqui o corpo é mínimo de propósito, ao contrário do de `salvar`. O backend
   * revalida a mescla inteira nos dois casos, então o corpo completo não compra
   * validação nenhuma — o que ele compra é o risco de reenviar por cima o que
   * outra aba acabou de gravar. Desligar é a ação mais frequente desta tela e
   * ela não pode carregar onze campos velhos junto.
   *
   * ELE FALHA COM 400 QUANDO A ARTE DA CAMPANHA SAIU DO CATÁLOGO, e não há
   * corpo que resolva: `update_admin` valida a arte sobre o resultado da
   * mescla, então nem um `{ is_active: false }` passa. Por isso a lista só
   * oferece este botão onde a arte está no ar — nos outros casos ela manda para
   * o diálogo, onde a arte nova viaja na mesma chamada. (A pendência é do
   * backend: desligar não deveria depender da arte.)
   */
  const alternarAtivo = useCallback(
    async (cupom: Coupon): Promise<string | null> => {
      setIsSaving(true);
      try {
        const gravado = await updateCoupon(cupom.id, { is_active: !cupom.is_active });
        guardar(gravado);
        return null;
      } catch (error) {
        return messageFromUnknownError(error);
      } finally {
        setIsSaving(false);
      }
    },
    [guardar],
  );

  return {
    cupons,
    artes,
    isLoading,
    isSaving,
    errorMessage,
    salvar,
    alternarAtivo,
    recarregar: carregar,
  };
}
