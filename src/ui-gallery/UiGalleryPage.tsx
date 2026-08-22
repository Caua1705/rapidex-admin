import { useState } from 'react';

import { useTheme } from '../theme/theme-context';
import {
  AlertIcon,
  Badge,
  Breadcrumb,
  Card,
  Checkbox,
  Field,
  FieldRow,
  HelpPopover,
  Input,
  OrderRow,
  PageBar,
  RadioGroup,
  RangeInput,
  DataTable,
  SearchField,
  Select,
  Spinner,
  StatusChip,
  Switch,
  Sheet,
  Tabs,
  Textarea,
} from '../ds';
import './UiGalleryPage.css';

/**
 * A GALERIA VIVA do design system — rota `/ui`, só em desenvolvimento.
 *
 * POR QUE ELA EXISTE: um componente que só é visto dentro da tela onde foi
 * usado nunca é visto em todos os seus estados. O erro, o desabilitado e o
 * ocupado são justamente os que ninguém abre no dia a dia, e são os que
 * quebram. Aqui eles estão todos ao lado uns dos outros, no tema claro e no
 * escuro, e a comparação é de relance.
 *
 * REGRA DE USO: componente novo entra aqui NA MESMA etapa em que nasce, com
 * todos os estados. Se um estado não está nesta página, ele não foi desenhado.
 */
export function UiGalleryPage() {
  const { theme, toggleTheme } = useTheme();

  const [texto, setTexto] = useState('Picanha na chapa');
  const [preco, setPreco] = useState('129,90');
  const [erroTexto, setErroTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [descricao, setDescricao] = useState('');
  const [de, setDe] = useState('90');
  const [dataDe, setDataDe] = useState('2026-08-01');
  const [dataAte, setDataAte] = useState('2026-08-21');
  const [ate, setAte] = useState('100');
  const [categoria, setCategoria] = useState('cortes');
  const [semEscolha, setSemEscolha] = useState('');
  const [taxa, setTaxa] = useState(true);
  const [parcial, setParcial] = useState(false);
  const [nua, setNua] = useState(true);
  const [tipo, setTipo] = useState('delivery');
  const [aberta, setAberta] = useState(true);
  const [disponivel, setDisponivel] = useState(true);
  const [aba, setAba] = useState('geral');
  const [coluna, setColuna] = useState('preparando');
  const [folha, setFolha] = useState(false);

  const categorias = [
    { value: 'promocoes', label: 'Promoções', hint: '10 itens' },
    { value: 'cortes', label: 'Cortes especiais', hint: '8 itens' },
    { value: 'guarnicoes', label: 'Guarnições', hint: '24 itens' },
    { value: 'bebidas', label: 'Bebidas', hint: '31 itens' },
    { value: 'inativa', label: 'Peixes (inativa)', disabled: true },
  ];

  return (
    <div className="gal">
      {/*
        A GALERIA USA A MESMA FAIXA DE 52px DAS TELAS DE VERDADE, e não é
        cerimônia: se o primitivo não serve para o próprio catálogo dele, ele
        não serve.
      */}
      <PageBar title="Design system" crumb="rota de desenvolvimento">
        <button type="button" className="btn btn--sm" onClick={toggleTheme}>
          Tema: {theme === 'dark' ? 'escuro' : 'claro'}
        </button>
      </PageBar>

      <div className="gal__body">
        <Secao titulo="Campo de texto" nota="A caixa é a mesma para todo controle de entrada.">
          <Amostra rotulo="Padrão">
            <Field label="Nome do item">
              <Input value={texto} onValueChange={setTexto} />
            </Field>
          </Amostra>

          <Amostra rotulo="Com afixo e ajuda">
            <Field label="Preço" hint="O que o cliente vê no cardápio.">
              <Input prefix="R$" value={preco} onValueChange={setPreco} inputMode="decimal" />
            </Field>
          </Amostra>

          <Amostra rotulo="Erro">
            <Field
              label="Nome do item"
              error={erroTexto === '' ? 'O item precisa de um nome.' : null}
            >
              <Input value={erroTexto} onValueChange={setErroTexto} />
            </Field>
          </Amostra>

          <Amostra rotulo="Ocupado">
            <Field label="CEP" hint="Verificando o endereço…">
              <Input value="60150-000" onValueChange={() => {}} loading />
            </Field>
          </Amostra>

          <Amostra rotulo="Desabilitado">
            <Field label="Taxa de entrega" disabled hint="Definida por filial, na aba Entrega.">
              <Input prefix="R$" value="7,50" onValueChange={() => {}} disabled />
            </Field>
          </Amostra>

          <Amostra rotulo="Obrigatório">
            <Field label="Nome da filial" required>
              <Input value="Matriz Aldeota" onValueChange={() => {}} />
            </Field>
          </Amostra>
        </Secao>

        <Secao titulo="Intervalo, busca e área de texto">
          <Amostra rotulo="Intervalo">
            <Field label="Tempo de preparo" hint="É a faixa que o cliente vê ao escolher a loja.">
              <RangeInput
                from={{ value: de, onValueChange: setDe, label: 'Tempo mínimo, em minutos' }}
                to={{ value: ate, onValueChange: setAte, label: 'Tempo máximo, em minutos' }}
                suffix="min"
              />
            </Field>
          </Amostra>

          {/*
            A FAIXA DE DATAS é a mesma peça, com `type="date"`. Ela existe porque
            o filtro de Clientes recorta o último pedido por dois dias — e faixa
            de data é exatamente o que este componente descreve: dois valores que
            são um dado, editados juntos e validados em par pelo backend.
          */}
          <Amostra rotulo="Intervalo de datas">
            <Field label="Último pedido" hint="O dia da loja, e o fim entra inteiro.">
              <RangeInput
                type="date"
                from={{ value: dataDe, onValueChange: setDataDe, label: 'A partir de' }}
                to={{ value: dataAte, onValueChange: setDataAte, label: 'Até' }}
              />
            </Field>
          </Amostra>

          <Amostra rotulo="Intervalo com erro">
            <Field label="Ticket médio" error="O ticket mínimo é maior que o máximo.">
              <RangeInput
                prefix="R$"
                inputMode="decimal"
                className="ds-range--faixa"
                from={{ value: '80', onValueChange: () => {}, label: 'Mínimo, em reais' }}
                to={{ value: '20', onValueChange: () => {}, label: 'Máximo, em reais' }}
              />
            </Field>
          </Amostra>

          <Amostra rotulo="Busca">
            <SearchField
              label="Buscar item nesta categoria"
              placeholder="Buscar item nesta categoria"
              value={busca}
              onValueChange={setBusca}
            />
          </Amostra>

          <Amostra rotulo="Área de texto">
            <Field label="Descrição" hint="Uma linha basta: ela aparece embaixo do nome.">
              <Textarea value={descricao} onValueChange={setDescricao} rows={3} />
            </Field>
          </Amostra>
        </Secao>

        <Secao
          titulo="Seletor"
          nota="Botão + lista. Setas andam, Enter escolhe, Esc fecha e devolve o foco."
        >
          <Amostra rotulo="Com escolha">
            <Field label="Categoria">
              <Select value={categoria} onChange={setCategoria} options={categorias} />
            </Field>
          </Amostra>

          <Amostra rotulo="Vazio">
            <Field label="Setor de impressão" hint="Onde a comanda deste item sai.">
              <Select
                value={semEscolha}
                onChange={setSemEscolha}
                options={categorias}
                placeholder="Não imprimir"
              />
            </Field>
          </Amostra>

          <Amostra rotulo="Erro">
            <Field label="Categoria" error="Escolha a categoria do item.">
              <Select value="" onChange={() => {}} options={categorias} />
            </Field>
          </Amostra>

          <Amostra rotulo="Carregando">
            <Field label="Filial">
              <Select value="" onChange={() => {}} options={[]} loading />
            </Field>
          </Amostra>

          <Amostra rotulo="Desabilitado">
            {/*
              O MOTIVO AQUI É AMOSTRA DE PADRÃO, NÃO REGRA DO PRODUTO: o que
              esta célula demonstra é a §5 — desabilitado não esconde o
              controle, e diz por quê.

              Ele já foi "Escolha uma filial no topo.", que era o eco da parede
              que o painel removeu: as seções de filial não pedem mais filial
              nenhuma, elas resolvem (ver `auth/branch-scope.ts`). Copiar aquela
              frase para a galeria a mantinha viva como se fosse padrão.
            */}
            <Field
              label="Filial"
              disabled
              hint="Disponível depois de salvar as alterações abertas."
            >
              <Select value="" onChange={() => {}} options={categorias} disabled />
            </Field>
          </Amostra>
        </Secao>

        <Secao
          titulo="Etiqueta"
          nota="Uma palavra sobre um plano de agrupamento. A variante de atenção existe para UM caso: o estado que o lojista não escolheu."
        >
          <Amostra rotulo="Etiqueta">
            <span className="tag">Inativo</span>
            <span className="tag">Esgotado</span>
            <span className="tag">Inativa</span>
          </Amostra>

          <Amostra rotulo="Etiqueta de atenção">
            {/*
              O ÚNICO CASO DA VARIANTE, e ele está aqui para que o próximo a
              precisar de "uma etiqueta colorida" veja qual é a régua: as três
              acima são decisões do lojista; esta ACONTECEU com ele — o item
              saiu de venda porque a última opção de um grupo obrigatório foi
              desativada, e ele não tem como saber sem alguém marcar.

              Três canais e nenhum sozinho: a palavra, o ícone e a tinta.
            */}
            <span className="tag tag--alerta">
              <AlertIcon size={12} />
              Sem opção
            </span>
          </Amostra>
        </Secao>

        <Secao titulo="Escolha">
          <Amostra rotulo="Caixa de marcar">
            <Checkbox
              checked={taxa}
              onChange={setTaxa}
              label="Cobrar taxa de serviço"
              hint="Some do carrinho do cliente quando desligada."
            />
            <Checkbox checked={parcial} onChange={setParcial} label="Aceita retirada no balcão" />
            <Checkbox
              checked={false}
              indeterminate
              onChange={() => {}}
              label="Marcado em parte (a lista abaixo está meio marcada)"
            />
            <Checkbox checked disabled onChange={() => {}} label="Marcado e travado" />
            <Checkbox checked={false} disabled onChange={() => {}} label="Desmarcado e travado" />
          </Amostra>

          <Amostra rotulo="Caixa sem rótulo — a que vive numa linha de lista">
            {/*
              `hideLabel` É PARA A LINHA DE LISTA, e o rótulo continua
              obrigatório: ele vira o `aria-label`, senão o leitor de tela
              anuncia quarenta caixas idênticas e nenhuma diz de qual item é.

              Ele NÃO vira um texto `sr-only`: um segundo nome do produto no
              documento torna ambígua toda busca por nome — foi assim que quatro
              testes de ponta a ponta quebraram de uma vez.

              Sem texto ao lado, o alvo volta a ser o quadrado de 18px — metade
              do mínimo da WCAG 2.5.8. O recuo devolve o alvo sem engordar o
              desenho.
            */}
            <Checkbox
              hideLabel
              checked={nua}
              onChange={setNua}
              label="Selecionar X-Burger Clássico"
            />
            <Checkbox
              hideLabel
              checked={false}
              indeterminate
              onChange={() => {}}
              label="Selecionar todos os 12 itens desta lista"
            />
            <Checkbox hideLabel checked disabled onChange={() => {}} label="Marcado e travado" />
          </Amostra>

          <Amostra rotulo="Rádio">
            <RadioGroup
              legend="Como o pedido chega"
              name="gal-tipo"
              value={tipo}
              onChange={setTipo}
              options={[
                { value: 'delivery', label: 'Entrega' },
                {
                  value: 'pickup',
                  label: 'Retirada no balcão',
                  hint: 'O cliente busca na loja.',
                },
                { value: 'mesa', label: 'Comer no local', disabled: true },
              ]}
            />
          </Amostra>

          <Amostra rotulo="Rádio com erro">
            <RadioGroup
              legend="Fluxo de pagamento"
              name="gal-fluxo"
              value=""
              onChange={() => {}}
              error="Escolha um fluxo para continuar."
              options={[
                { value: 'online', label: 'Online, antes de preparar' },
                { value: 'entrega', label: 'Na entrega' },
              ]}
            />
          </Amostra>
        </Secao>

        <Secao titulo="Interruptor" nota="Efeito imediato: não passa por botão de salvar.">
          <Amostra rotulo="Com rótulo">
            <Switch
              checked={aberta}
              onChange={setAberta}
              label="Loja aberta"
              hint="O cardápio está no ar e os clientes conseguem fazer pedido."
            />
          </Amostra>

          <Amostra rotulo="Estados">
            <div className="gal__row">
              <Switch checked={disponivel} onChange={setDisponivel} label="Disponível" hideLabel />
              <Switch checked={false} onChange={() => {}} label="Esgotado" hideLabel />
              <Switch checked onChange={() => {}} label="Gravando" hideLabel loading />
              <Switch checked disabled onChange={() => {}} label="Travado ligado" hideLabel />
              <Switch
                checked={false}
                disabled
                onChange={() => {}}
                label="Travado desligado"
                hideLabel
              />
            </div>
          </Amostra>

          <Amostra rotulo="Ocupado, com rótulo">
            <Switch checked onChange={() => {}} label="Aceita entrega" loading />
          </Amostra>
        </Secao>

        <Secao titulo="Espera">
          <Amostra rotulo="Spinner">
            <div className="gal__row">
              <Spinner />
              <Spinner label="Salvando…" />
            </div>
          </Amostra>
        </Secao>

        <Secao
          titulo="Linha de pedido"
          nota="A unidade da lista. O estágio é a coluna mesclada — escrito na linha que ABRE o bloco, com o fio de cor descendo nas seguintes. O fio embaixo do tempo é a barra de maturação: preenche contra a janela de preparo da loja (aqui, 100 min). Estreite a lista para ver o layout compacto: ele é outro desenho, e não a linha dobrada em duas."
        >
          <Amostra rotulo="Um bloco de estágio" larga>
            <div className="gal__lista">
              <OrderRow
                stage="preparando"
                stageLabel="Em preparo"
                abreBloco
                number={1042}
                elapsedLabel="18 min"
                elapsedMinutes={18}
                windowMinutes={100}
                timeLabel="20:41"
                customer="Marcos Lima"
                modalidade="Entrega"
                pagamento="Pix"
                pagamentoNota="Pago"
                total="R$ 192,90"
                onOpen={() => {}}
              />
              <OrderRow
                stage="preparando"
                stageLabel="Em preparo"
                number={1043}
                elapsedLabel="62 min"
                elapsedMinutes={62}
                windowMinutes={100}
                timeLabel="19:58"
                customer="Ana Paula Nogueira"
                modalidade="Entrega"
                pagamento="Dinheiro"
                pagamentoNota="Paga na entrega"
                total="R$ 147,00"
                onOpen={() => {}}
              />
              <OrderRow
                stage="preparando"
                stageLabel="Em preparo"
                number={1044}
                elapsedLabel="94 min"
                elapsedMinutes={94}
                windowMinutes={100}
                timeLabel="19:26"
                customer="Rafael Nunes"
                modalidade="Retirada"
                pagamento="Débito"
                pagamentoNota="Pago"
                total="R$ 89,90"
                onOpen={() => {}}
              />
            </div>
          </Amostra>

          <Amostra rotulo="Aguardando pagamento, escolhida e sem janela" larga>
            <div className="gal__lista">
              <OrderRow
                stage="pendente"
                stageLabel="Novos"
                abreBloco
                number={1045}
                elapsedLabel="4 min"
                elapsedMinutes={4}
                windowMinutes={100}
                timeLabel="21:02"
                customer="Juliana Alves"
                modalidade="Entrega"
                pagamento="Pix"
                total="R$ 124,00"
                alerta="Aguardando pagamento — não preparar"
                onOpen={() => {}}
              />
              <OrderRow
                stage="pronto"
                stageLabel="Prontos e na rua"
                abreBloco
                number={1046}
                elapsedLabel="41 min"
                elapsedMinutes={41}
                windowMinutes={100}
                timeLabel="20:19"
                customer="Pedro Henrique"
                modalidade="Entrega"
                pagamento="Pix"
                pagamentoNota="Pago"
                total="R$ 236,40"
                selected
                onOpen={() => {}}
              />
              <OrderRow
                stage="aceito"
                stageLabel="Aceitos"
                number={1047}
                elapsedLabel="7 min"
                elapsedMinutes={7}
                windowMinutes={null}
                timeLabel="20:55"
                customer="Camila Souza"
                modalidade="Retirada"
                pagamento="Crédito"
                pagamentoNota="Pago"
                total="R$ 98,00"
                onOpen={() => {}}
              />
            </div>
          </Amostra>
        </Secao>

        <Secao titulo="Estado e contagem" nota="Cor, texto e forma — sempre os três juntos.">
          <Amostra rotulo="Chips" larga>
            <div className="gal__row">
              {(
                [
                  'pendente',
                  'aceito',
                  'preparando',
                  'pronto',
                  'entrega',
                  'concluido',
                  'cancelado',
                ] as const
              ).map((stage) => (
                <StatusChip key={stage} stage={stage} />
              ))}
            </div>
          </Amostra>

          <Amostra rotulo="Chips pequenos" larga>
            <div className="gal__row">
              {(['pendente', 'pronto', 'cancelado'] as const).map((stage) => (
                <StatusChip key={stage} stage={stage} size="sm" />
              ))}
            </div>
          </Amostra>

          <Amostra rotulo="Contadores">
            <div className="gal__row">
              <Badge value={0} />
              <Badge value={12} />
              <Badge value={3} alerta />
            </div>
          </Amostra>
        </Secao>

        <Secao titulo="Cartão e lista">
          <Amostra rotulo="Cartão" larga>
            <Card title="Pedido" hint="O que o cliente vê antes de fechar.">
              <FieldRow>
                <Field label="Valor mínimo">
                  <Input prefix="R$" value="20,00" onValueChange={() => {}} />
                </Field>
                <Field label="Tempo estimado">
                  <RangeInput
                    from={{ value: de, onValueChange: setDe, label: 'Mínimo' }}
                    to={{ value: ate, onValueChange: setAte, label: 'Máximo' }}
                    suffix="min"
                  />
                </Field>
              </FieldRow>
            </Card>
          </Amostra>

          <Amostra rotulo="Linha de item do cardápio" larga>
            <Card>
              <ul className="ds-itens">
                {[
                  { nome: 'Picanha à Moda (1kg)', desc: 'Serve 4 pessoas', preco: 'R$ 192,90' },
                  { nome: 'Filé à Parmegiana (400g)', desc: 'Serve 2 pessoas', preco: 'R$ 94,70' },
                ].map((item) => (
                  <li className="ds-item" key={item.nome}>
                    <span className="ds-item__foto" aria-hidden="true" />
                    <span className="ds-item__texto">
                      <span className="ds-item__nome">
                        <span className="ds-item__nome-texto t-section">{item.nome}</span>
                        <span className="ds-item__preco-inline">{item.preco}</span>
                      </span>
                      <span className="ds-item__desc t-aux">{item.desc}</span>
                    </span>
                    <span className="ds-item__preco">{item.preco}</span>
                    <span className="ds-item__fim">
                      <Switch checked onChange={() => {}} label={item.nome} hideLabel />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Amostra>

          <Amostra rotulo="Tabela responsiva" larga>
            <Card>
              <DataTable
                caption="Formas de pagamento da filial"
                columns={[
                  { key: 'forma', header: 'Forma' },
                  { key: 'tipo', header: 'Tipo' },
                  { key: 'estado', header: 'Estado', align: 'end' },
                ]}
                rows={[
                  {
                    id: '1',
                    forma: 'Pix',
                    tipo: 'Online',
                    estado: <StatusChip stage="pronto" size="sm" />,
                  },
                  {
                    id: '2',
                    forma: 'Dinheiro',
                    tipo: 'Na entrega',
                    estado: <StatusChip stage="pronto" size="sm" />,
                  },
                  {
                    id: '3',
                    forma: 'Vale-refeição',
                    tipo: 'Na entrega',
                    estado: <StatusChip stage="concluido" size="sm" />,
                  },
                ]}
              />
            </Card>
          </Amostra>
        </Secao>

        <Secao
          titulo="Navegação"
          nota="Nas abas, Tab sai para o conteúdo e as setas trocam de aba."
        >
          <Amostra rotulo="Abas" larga>
            <Tabs
              label="Configurações da loja"
              value={aba}
              onChange={setAba}
              tabs={[
                { id: 'geral', label: 'Geral' },
                { id: 'filial', label: 'Filial' },
                { id: 'horarios', label: 'Horários' },
                { id: 'entrega', label: 'Entrega' },
                { id: 'pagamento', label: 'Formas de pagamento' },
                { id: 'impressao', label: 'Impressão' },
              ]}
            />
          </Amostra>

          <Amostra rotulo="Abas com contagem">
            <Tabs
              label="Pedidos por status"
              value={coluna}
              onChange={setColuna}
              tabs={[
                { id: 'pendente', label: 'Pendente', count: 3 },
                { id: 'preparando', label: 'Preparando', count: 12 },
                { id: 'pronto', label: 'Pronto', count: 0 },
              ]}
            />
          </Amostra>

          <Amostra rotulo="Trilha">
            <Breadcrumb
              items={[{ label: 'Cardápio', to: '/cardapio' }, { label: 'Cortes especiais' }]}
            />
          </Amostra>

          <Amostra rotulo="Folha inferior">
            <button type="button" className="btn btn--sm" onClick={() => setFolha(true)}>
              Abrir a folha
            </button>
            <Sheet open={folha} title="Mudar o status" onClose={() => setFolha(false)}>
              {['Aceito', 'Preparando', 'Pronto', 'Saiu para entrega'].map((nome) => (
                <button
                  key={nome}
                  type="button"
                  className="ds-sheet__opcao"
                  onClick={() => setFolha(false)}
                >
                  {nome}
                </button>
              ))}
            </Sheet>
          </Amostra>
        </Secao>

        <Secao
          titulo="Ajuda de tela"
          nota="A explicação que se lê uma vez na vida, e que por isso não pode ocupar a tela todo dia. Esc fecha e devolve o foco ao ícone; sair com Tab também fecha."
        >
          <Amostra rotulo="Fechada — o que a tela mostra por padrão">
            <span className="t-title">Clientes</span>
            <HelpPopover label="Como ler esta tela" title="Como ler esta tela">
              <p className="t-aux">
                Quem já pediu nesta loja, agrupado por telefone. E-mail e CPF são da conta do
                cliente na plataforma e não aparecem aqui.
              </p>
            </HelpPopover>
          </Amostra>

          <Amostra rotulo="Ao lado de uma ressalva de escopo" larga>
            <span className="t-title">Clientes</span>
            <span className="t-aux">classificação do restaurante inteiro</span>
            <HelpPopover label="Como ler a classificação" title="Como ler a classificação">
              <p className="t-aux">
                A classificação e o ticket médio são <strong>do restaurante inteiro</strong> — o
                mesmo cliente pode ser Fiel no restaurante e Perdido numa loja, e as duas leituras
                estão certas.
              </p>
              <p className="t-aux">
                O ritmo é de cada cliente: quem pede toda semana entra em risco em duas semanas;
                quem pede uma vez por mês, em dois meses.
              </p>
            </HelpPopover>
          </Amostra>
        </Secao>

        <Secao titulo="Campos lado a lado">
          <Amostra rotulo="Linha de campos" larga>
            <FieldRow>
              <Field label="Cidade">
                <Input value="Fortaleza" onValueChange={() => {}} />
              </Field>
              <Field label="Estado">
                <Input value="CE" onValueChange={() => {}} />
              </Field>
              <Field label="CEP">
                <Input value="60150-000" onValueChange={() => {}} inputMode="numeric" />
              </Field>
            </FieldRow>
          </Amostra>
        </Secao>
      </div>
    </div>
  );
}

function Secao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="gal__secao">
      <div className="gal__secao-cab">
        <h2 className="t-section">{titulo}</h2>
        {nota ? <p className="t-aux">{nota}</p> : null}
      </div>
      <div className="gal__grade">{children}</div>
    </section>
  );
}

function Amostra({
  rotulo,
  larga = false,
  children,
}: {
  rotulo: string;
  /** Ocupa a largura toda: para o que só se lê espalhado, como uma linha de campos. */
  larga?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`gal__amostra${larga ? ' gal__amostra--larga' : ''}`}>
      <p className="t-label">{rotulo}</p>
      <div className="gal__palco">{children}</div>
    </div>
  );
}
