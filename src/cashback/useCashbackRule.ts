import { useCallback, useEffect, useState } from 'react';

import {
  deleteBranchCashbackRule,
  fetchBranchCashbackRule,
  fetchRestaurantCashbackRule,
  replaceBranchCashbackRule,
  replaceRestaurantCashbackRule,
} from '../api/cashback';
import { messageFromUnknownError } from '../api/errors';
import type { CashbackRuleView } from '../api/types';
import { bodyFrom, draftFrom, type CashbackDraft } from './cashback-model';

/** Qual das duas regras esta tela está editando. */
export type EscopoDaRegra = 'rede' | 'filial';

/**
 * A REGRA QUE A TELA EDITA, E A ORIGEM DELA.
 *
 * O hook carrega de novo a cada troca de escopo E a cada troca de filial. Não
 * há cache entre os dois: a regra da rede e a da Aldeota são linhas diferentes,
 * e mostrar a de uma enquanto a outra carrega faria o lojista ler números que
 * não são os da tela que ele abriu — num formulário cujo botão grava
 * faturamento.
 *
 * O RASCUNHO NASCE DA RESPOSTA, sempre. Trocar de escopo DESCARTA a edição em
 * curso, e é de propósito: as duas regras não têm campos em comum a preservar —
 * são a mesma forma sobre linhas diferentes, e carregar o texto de uma para a
 * outra é como se cria uma sobrescrita que ninguém digitou.
 */
export function useCashbackRule(escopo: EscopoDaRegra, branchId: string) {
  const [view, setView] = useState<CashbackRuleView | null>(null);
  const [draft, setDraft] = useState<CashbackDraft | null>(null);
  /*
   * O RASCUNHO COMO ELE CHEGOU, para saber se há o que salvar.
   *
   * A `SaveBar` só aparece quando existe alteração, e a comparação é sobre o
   * RASCUNHO e não sobre o corpo do PUT: `bodyFrom` normaliza ("10" e "10,00"
   * viram `"10.00"`), então comparar corpos diria "sem alteração" para uma
   * digitação que a tela mostra diferente do que carregou.
   */
  const [pristine, setPristine] = useState<CashbackDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /** Sem filial não há o que ler no escopo de filial — e nem rota a chamar. */
  const semFilial = escopo === 'filial' && branchId === '';

  const carregar = useCallback(async () => {
    if (semFilial) {
      setView(null);
      setDraft(null);
      setPristine(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const carregada =
        escopo === 'rede'
          ? await fetchRestaurantCashbackRule()
          : await fetchBranchCashbackRule(branchId);
      setView(carregada);
      setDraft(draftFrom(carregada.rule));
      setPristine(draftFrom(carregada.rule));
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      setView(null);
      setDraft(null);
      setPristine(null);
    } finally {
      setIsLoading(false);
    }
  }, [escopo, branchId, semFilial]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Grava a regra inteira. `PUT`, sempre — ver `CashbackRuleWrite`.
   *
   * A RESPOSTA VOLTA PARA A TELA, e com ela o `source`: salvar numa filial que
   * herdava faz a origem virar `branch` no mesmo instante, e a frase do topo
   * deixa de dizer "salvar aqui cria uma sobrescrita" para dizer "esta loja tem
   * regra própria". Sem isso o lojista continuaria lendo a frase de antes por
   * cima do estado de depois.
   */
  const salvar = useCallback(
    async (rascunho: CashbackDraft): Promise<boolean> => {
      if (semFilial) return false;
      setIsSaving(true);
      setErrorMessage(null);
      try {
        const body = bodyFrom(rascunho);
        const gravada =
          escopo === 'rede'
            ? await replaceRestaurantCashbackRule(body)
            : await replaceBranchCashbackRule(branchId, body);
        setView({ source: escopo === 'rede' ? 'restaurant' : 'branch', rule: gravada });
        setDraft(draftFrom(gravada));
        setPristine(draftFrom(gravada));
        setSavedAt(Date.now());
        return true;
      } catch (error) {
        setErrorMessage(messageFromUnknownError(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [escopo, branchId, semFilial],
  );

  /**
   * Apaga a sobrescrita e RECARREGA — não adivinha o que a filial passa a ver.
   *
   * Depois do 204, a regra que vale ali é a da rede, e o painel não a tem em
   * mãos: ele está com a da filial, que acabou de deixar de existir. Montar o
   * estado seguinte na tela seria inventar números; a releitura devolve o
   * `source` de verdade, que tanto pode ser `restaurant` quanto `none`.
   */
  const apagarSobrescrita = useCallback(async (): Promise<boolean> => {
    if (escopo !== 'filial' || branchId === '') return false;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await deleteBranchCashbackRule(branchId);
      await carregar();
      return true;
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [escopo, branchId, carregar]);

  /* Objeto pequeno e de forma fixa: `JSON.stringify` basta e não tem como
     divergir de uma comparação campo a campo escrita à mão. */
  const isDirty =
    draft !== null && pristine !== null && JSON.stringify(draft) !== JSON.stringify(pristine);

  return {
    view,
    draft,
    setDraft,
    isDirty,
    isLoading,
    isSaving,
    errorMessage,
    savedAt,
    salvar,
    apagarSobrescrita,
    recarregar: carregar,
  };
}
