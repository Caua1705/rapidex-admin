import { useState } from 'react';

import { CheckIcon } from '../ds/icons';
import { SearchField } from '../ds/SearchField';
import { formatCurrency } from '../orders/format';
import { pairWith, type CatalogPair, type CatalogTwin } from './catalog-key';
import { useTwinSearch } from './useTwinSearch';

/**
 * "É o mesmo item de outra loja?"
 *
 * ----------------------------------------------------------------------------
 * O DEFEITO QUE ESTE CAMPO EXISTE PARA FECHAR
 * ----------------------------------------------------------------------------
 *
 * A migração pareou os 161 itens que já existiam: cada um nasceu com a mesma
 * `catalog_key` nas duas lojas, e `/reports/products` soma os dois numa linha.
 * TUDO O QUE O LOJISTA CADASTRA DEPOIS NASCE SEM CHAVE — e um item sem chave
 * some do agrupamento. Ele continua no relatório, contado sozinho, então nada
 * fica visivelmente errado: a linha "Picanha" simplesmente para de crescer e
 * uma segunda "Picanha" aparece embaixo, com o número da outra loja.
 *
 * É a pior forma de erro que este painel tem: não há tela em branco, não há
 * mensagem, não há 500. Há um número menor do que devia, descoberto no fim do
 * mês, se for descoberto.
 *
 * ----------------------------------------------------------------------------
 * POR QUE ESCOLHER O ITEM, E NÃO DIGITAR A CHAVE
 * ----------------------------------------------------------------------------
 *
 * `catalog_key` é texto livre, e o campo mais óbvio seria uma caixa de texto.
 * Só que a chave é um id — `4f9c…` — que o lojista nunca viu e não tem onde
 * copiar: ela não aparece em nenhuma tela, nem no app do cliente, nem na
 * comanda. Uma caixa de texto aqui seria um campo que só se preenche errado.
 *
 * A pergunta que ele SABE responder é "este item é a mesma picanha da Zona
 * Norte?". Então a tela pergunta isso, procura pelo nome, e a chave é escolhida
 * pelo sistema — inclusive quando não existe nenhuma ainda (ver `catalog-key.ts`).
 *
 * NÃO APARECE COM UMA LOJA SÓ. Sem segunda filial não há o que agrupar, e o
 * campo seria um controle que não distingue nada. Quem decide é
 * `catalogPairingApplies`, e quem chama já o consultou.
 */
export function CatalogPairField({
  branchId,
  productName,
  pair,
  onChange,
}: {
  /** A filial do item que está sendo editado — a única que a busca não varre. */
  branchId: string;
  /** O nome digitado, que a busca já usa como primeiro termo. */
  productName: string;
  pair: CatalogPair | null;
  onChange: (pair: CatalogPair | null) => void;
}) {
  const [escolhendo, setEscolhendo] = useState(false);

  return (
    <div className="field" data-testid="product-catalog-pair">
      <span className="field__label">Mesmo item em outra loja</span>

      {escolhendo ? (
        <Escolhedor
          branchId={branchId}
          productName={productName}
          onPick={(twin) => {
            onChange(pairWith(twin));
            setEscolhendo(false);
          }}
          onCancel={() => setEscolhendo(false)}
        />
      ) : pair ? (
        <div className="pair__atual">
          <p className="pair__estado t-body">
            {pair.twin ? (
              <>
                <CheckIcon size={14} aria-hidden="true" />
                <span>
                  Conta junto com <strong>{pair.twin.name}</strong>, da{' '}
                  <strong>{pair.twin.branchLabel}</strong>.
                </span>
              </>
            ) : (
              /*
                CHAVE SEM PAR CONHECIDO, e a frase não inventa um.
                `GET /admin/products` não filtra por `catalog_key`, então o
                painel sabe que a chave existe e não sabe com quem ela pareia.
                Procurar o par pelo nome erraria em todo item renomeado de um
                lado só — e um nome errado aqui é pior que nome nenhum.
              */
              <span>
                Este item já tem chave de catálogo: no relatório ele soma com os itens de outras
                lojas que tenham a mesma chave.
              </span>
            )}
          </p>

          <div className="pair__acoes">
            <button
              type="button"
              className="btn btn--sm"
              data-testid="catalog-pair-change"
              onClick={() => setEscolhendo(true)}
            >
              Trocar
            </button>
            {/*
              SEPARAR NÃO É DESTRUTIVO, e por isso não leva a tinta de perigo.
              Ele apaga uma chave de agrupamento de relatório: nada sai do
              cardápio, nada deixa de ser vendido, e refazer o par é escolher o
              item de novo. Em `--danger` ao lado de "Trocar", as duas ações
              liam como pesos diferentes — e a vermelha atraía o clique que a
              pessoa não queria dar.
            */}
            <button
              type="button"
              className="btn btn--sm"
              data-testid="catalog-pair-clear"
              onClick={() => onChange(null)}
            >
              Separar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--sm"
          data-testid="catalog-pair-open"
          onClick={() => setEscolhendo(true)}
        >
          Escolher item de outra loja
        </button>
      )}

      {/*
        A RESSALVA É O QUE IMPEDE O CAMPO DE PARECER HERANÇA. "Mesmo item em
        outra loja" lido sozinho promete que mudar o preço aqui muda lá — e não
        muda nada: as duas linhas seguem independentes, e o único efeito é uma
        linha de relatório. Sem esta frase, o campo cria a expectativa que o
        passo inteiro do backend existe para NÃO criar.
      */}
      <span className="field__hint">
        Só para o relatório: itens marcados como o mesmo aparecem numa linha só em Desempenho.
        Preço, disponibilidade e cardápio continuam independentes em cada loja.
      </span>
    </div>
  );
}

/**
 * A busca, aberta dentro do próprio diálogo.
 *
 * NÃO É UM SEGUNDO DIÁLOGO por cima do primeiro: uma janela modal que abre
 * outra janela modal esconde o formulário que a pessoa estava preenchendo, e
 * fechar a de cima com Esc costuma fechar as duas. Aqui a busca ocupa o lugar
 * do botão, no mesmo campo, e o resto do formulário continua visível.
 */
function Escolhedor({
  branchId,
  productName,
  onPick,
  onCancel,
}: {
  branchId: string;
  productName: string;
  onPick: (twin: CatalogTwin) => void;
  onCancel: () => void;
}) {
  const busca = useTwinSearch(branchId, productName);

  return (
    <div className="pair__busca">
      <div className="pair__busca-linha">
        <SearchField
          label="Buscar o mesmo item em outra loja"
          placeholder="Nome do item na outra loja"
          value={busca.term}
          onValueChange={busca.setTerm}
        />
        {/*
          PALAVRA, E NÃO UM SEGUNDO "X". `SearchField` já tem o dele para
          limpar o termo, e dois ícones idênticos encostados um no outro não
          dizem qual apaga o texto e qual desiste da escolha — no telefone, com
          o dedo, eles viram um alvo só de 88px com dois destinos.
        */}
        <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
          Fechar
        </button>
      </div>

      {busca.errorMessage ? (
        <p className="alert alert--error" role="alert">
          {busca.errorMessage}
        </p>
      ) : busca.termoCurto ? (
        /*
          "NENHUM ITEM ENCONTRADO" SÓ É UMA AFIRMAÇÃO DEPOIS DE PROCURAR. Com
          uma letra digitada não houve busca nenhuma, e dizer que não achou faz
          o lojista concluir que o item não existe na outra loja.
        */
        <p className="faint pair__vazio">Digite o nome do item como ele está na outra loja.</p>
      ) : busca.isLoading ? (
        <p className="faint pair__vazio">Procurando…</p>
      ) : busca.results.length === 0 ? (
        <p className="faint pair__vazio">
          Nenhum item com esse nome nas outras lojas. Se ele ainda não existe lá, cadastre-o
          primeiro — o pareamento precisa dos dois lados.
        </p>
      ) : (
        <ul className="pair__lista" data-testid="catalog-pair-results">
          {busca.results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="pair__resultado"
                data-testid={`catalog-pair-result-${item.id}`}
                onClick={() => onPick(item)}
              >
                <span className="pair__resultado-nome">{item.name}</span>
                <span className="pair__resultado-meta faint">
                  {item.branchLabel} · <span className="tnum">{formatCurrency(item.price)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
