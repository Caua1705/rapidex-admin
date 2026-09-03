import { useState } from 'react';

import { useSession } from '../auth/session-context';
import { usePermissoes } from '../auth/use-permissions';
import { branchName as nomeDaFilial } from '../layout/branch-heading';
import { Select } from '../ds';
import { formatPhone } from '../customers/customer-model';
import { podeReceberEntregador } from './assignment-model';
import { useCouriers } from './useCouriers';
import { useOrderCourier } from './useOrderCourier';
import './EntregadorDoPedido.css';

/**
 * ============================================================================
 * QUEM ESTÁ COM ESTE PEDIDO — dentro do detalhe
 * ============================================================================
 *
 * ELE FICA COLADO NO ENDEREÇO, e não no fim do painel: o endereço é para onde o
 * pedido vai, e isto é quem o está levando. Separar os dois obrigaria a rolar
 * entre a resposta e a pergunta durante o telefonema do cliente que ligou
 * perguntando da entrega — que é o único momento em que alguém abre isto.
 *
 * ELE NÃO APARECE EM RETIRADA, e essa é a decisão de desenho mais importante
 * daqui. `not_delivery` é uma das quatro recusas do contrato, e a tela sabe
 * prevê-la olhando o próprio pedido: oferecer o botão para depois explicar que
 * "retirada não tem entregador" é pior que não oferecê-lo — o lojista clica,
 * lê, e aprende que o painel promete o que não cumpre. O mesmo vale para o
 * pedido que já terminou.
 *
 * ----------------------------------------------------------------------------
 * A LISTA DE ENTREGADORES É A DA FILIAL DO PEDIDO
 * ----------------------------------------------------------------------------
 *
 * Não a do seletor do topo. Com "todas as filiais" escolhidas o quadro mistura
 * as lojas, e oferecer o motoboy da Aldeota para um pedido do Centro é montar
 * na tela o `other_branch` que o backend vai recusar — a recusa que a tela
 * PODE evitar, evita-se antes.
 *
 * SÓ OS ATIVOS SÃO OFERECIDOS: entregador inativo é 409 na atribuição, e é a
 * terceira recusa que a tela consegue prever sozinha.
 */
export function EntregadorDoPedido({
  orderId,
  branchId,
  orderType,
  status,
}: {
  orderId: string;
  /** A filial DO PEDIDO — ver o cabeçalho. */
  branchId: string;
  orderType: string;
  status: string;
}) {
  const { pode } = usePermissoes();
  const { branches } = useSession();
  const podeAtribuir = pode('entregadores.atribuir');

  const habilitado = podeReceberEntregador({ order_type: orderType, status });

  const entregadores = useCouriers(habilitado ? branchId : '');
  const alvo = useOrderCourier(orderId, habilitado);

  const [escolhido, setEscolhido] = useState('');

  // RETIRADA E PEDIDO ENCERRADO NÃO TÊM BLOCO. Ver o cabeçalho.
  if (!habilitado) return null;

  /*
   * O NOME DA FILIAL DO PEDIDO, para a frase de `other_branch`.
   *
   * Ela é INALCANÇÁVEL a partir DESTA tela — os entregadores oferecidos são
   * os da filial do pedido, então o backend não tem como recusar por filial.
   * O contexto vai assim mesmo porque quem escreve a frase é uma função só,
   * compartilhada com a atribuição em lote, onde o caso é real: lá o
   * entregador é fixo e os pedidos variam.
   */
  const filial = branches.find((entrada) => entrada.id === branchId) ?? null;
  const filialDoPedido = filial ? nomeDaFilial(filial) : 'outra filial';

  const ativos = entregadores.couriers.filter((courier) => courier.is_active);
  const selecionado = ativos.find((courier) => courier.id === escolhido) ?? null;

  async function entregar() {
    if (!selecionado) return;
    const deuCerto = await alvo.atribuir(selecionado, filialDoPedido);
    if (deuCerto) setEscolhido('');
  }

  return (
    <section className="detail__block" data-testid="pedido-entregador">
      <h3 className="detail__heading">Entregador</h3>

      {/*
        A LEITURA QUE FALHOU NÃO VIRA "NINGUÉM AINDA". Sem resposta, a tela não
        afirma que o pedido está parado esperando alguém — dizer isso sobre um
        pedido que JÁ saiu manda o lojista atribuir de novo, e dois motoboys
        para o mesmo endereço.
      */}
      {alvo.errorMessage ? (
        <p className="alert alert--error" role="alert" data-testid="pedido-entregador-erro">
          {alvo.errorMessage}
        </p>
      ) : null}

      {alvo.entregador === undefined && !alvo.errorMessage ? (
        <p className="muted">Carregando…</p>
      ) : null}

      {alvo.entregador ? (
        <div className="entregador-do-pedido__atual" data-testid="pedido-entregador-atual">
          <span className="entregador-do-pedido__nome">{alvo.entregador.name}</span>
          <a className="faint" href={`tel:${alvo.entregador.phone}`}>
            {formatPhone(alvo.entregador.phone)}
          </a>
        </div>
      ) : null}

      {/*
        "NINGUÉM AINDA" É ESTADO NORMAL, e a frase diz isso sem alarme: os dois
        campos nulos são 200, e um pedido em preparo sem entregador é o caso
        comum das primeiras horas de vida dele.
      */}
      {alvo.entregador === null ? (
        <p className="muted" data-testid="pedido-entregador-ninguem">
          Ninguém pegou este pedido ainda.
        </p>
      ) : null}

      {podeAtribuir && alvo.entregador !== undefined ? (
        <div className="entregador-do-pedido__acao">
          {ativos.length === 0 ? (
            <p className="field__hint" data-testid="pedido-entregador-sem-lista">
              Nenhum entregador ativo nesta filial. Cadastre em Entregadores.
            </p>
          ) : (
            <>
              <Select
                value={escolhido}
                onChange={setEscolhido}
                /*
                  QUEM JÁ ESTÁ COM O PEDIDO SAI DA LISTA. Atribuir ao mesmo é
                  no-op no backend, então não haveria estrago — mas oferecê-lo
                  é oferecer um "Passar" que não passa nada, e o lojista fica
                  esperando uma mudança que não vem.
                */
                options={ativos
                  .filter((courier) => courier.id !== alvo.entregador?.id)
                  .map((courier) => ({ value: courier.id, label: courier.name }))}
                aria-label={alvo.entregador ? 'Passar o pedido para' : 'Entregar o pedido a'}
                disabled={alvo.isSaving}
                data-testid="pedido-entregador-seletor"
              />

              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={!selecionado || alvo.isSaving}
                onClick={() => void entregar()}
                data-testid="pedido-entregador-atribuir"
              >
                {alvo.isSaving ? 'Salvando…' : alvo.entregador ? 'Passar' : 'Entregar'}
              </button>
            </>
          )}

          {/*
            TIRAR SÓ EXISTE QUANDO ALGUÉM ESTÁ COM ELE. O 409 desta rota é
            exatamente "ninguém está", e é clique repetido ou tela velha —
            oferecer o botão sem ninguém seria fabricar esse 409.
          */}
          {alvo.entregador ? (
            <button
              type="button"
              className="btn btn--sm"
              disabled={alvo.isSaving}
              onClick={() => void alvo.desatribuir()}
              data-testid="pedido-entregador-tirar"
            >
              Tirar
            </button>
          ) : null}
        </div>
      ) : null}

      {alvo.problema ? (
        <p className="alert alert--error" role="alert" data-testid="pedido-entregador-recusa">
          {alvo.problema}
        </p>
      ) : null}
    </section>
  );
}
