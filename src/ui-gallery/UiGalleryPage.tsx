import { useState } from 'react';

import { useTheme } from '../theme/theme-context';
import {
  Badge,
  Breadcrumb,
  Card,
  Checkbox,
  Field,
  FieldRow,
  Input,
  OrderTicket,
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
  const [ate, setAte] = useState('100');
  const [categoria, setCategoria] = useState('cortes');
  const [semEscolha, setSemEscolha] = useState('');
  const [taxa, setTaxa] = useState(true);
  const [parcial, setParcial] = useState(false);
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
      <header className="gal__bar">
        <h1 className="t-title">Design system</h1>
        <p className="t-aux">
          Rota de desenvolvimento. Todo componente aparece aqui com todos os seus estados.
        </p>
        <button type="button" className="gal__theme" onClick={toggleTheme}>
          Tema: {theme === 'dark' ? 'escuro' : 'claro'}
        </button>
      </header>

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
            <Field label="Filial" disabled hint="Disponível depois de salvar as alterações abertas.">
              <Select value="" onChange={() => {}} options={categorias} disabled />
            </Field>
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
          titulo="Ticket de pedido"
          nota="O fio no topo é a barra de maturação: preenche contra a janela de preparo da loja (aqui, 100 min) e muda de cor em 50% e 85%."
        >
          <Amostra rotulo="No prazo">
            <OrderTicket
              stage="preparando"
              number={1042}
              elapsedLabel="18 min"
              elapsedMinutes={18}
              windowMinutes={100}
              timeLabel="20:41"
              customer="Marcos Lima"
              total="R$ 192,90"
              tags={['Entrega', 'Pix']}
              onOpen={() => {}}
            />
          </Amostra>

          <Amostra rotulo="Na janela (50%)">
            <OrderTicket
              stage="preparando"
              number={1043}
              elapsedLabel="62 min"
              elapsedMinutes={62}
              windowMinutes={100}
              timeLabel="19:58"
              customer="Ana Paula Nogueira"
              total="R$ 147,00"
              tags={['Entrega', 'Dinheiro']}
              onOpen={() => {}}
            />
          </Amostra>

          <Amostra rotulo="Estourando (85%)">
            <OrderTicket
              stage="preparando"
              number={1044}
              elapsedLabel="94 min"
              elapsedMinutes={94}
              windowMinutes={100}
              timeLabel="19:26"
              customer="Rafael Nunes"
              total="R$ 89,90"
              tags={['Retirada']}
              onOpen={() => {}}
            />
          </Amostra>

          <Amostra rotulo="Aguardando pagamento">
            <OrderTicket
              stage="pendente"
              number={1045}
              elapsedLabel="4 min"
              elapsedMinutes={4}
              windowMinutes={100}
              timeLabel="21:02"
              customer="Juliana Alves"
              total="R$ 124,00"
              tags={['Entrega', 'Pix']}
              alerta="Aguardando pagamento — não preparar"
              onOpen={() => {}}
            />
          </Amostra>

          <Amostra rotulo="Escolhido">
            <OrderTicket
              stage="pronto"
              number={1046}
              elapsedLabel="41 min"
              elapsedMinutes={41}
              windowMinutes={100}
              timeLabel="20:19"
              customer="Pedro Henrique"
              total="R$ 236,40"
              tags={['Entrega']}
              selected
              onOpen={() => {}}
            />
          </Amostra>

          <Amostra rotulo="Sem janela configurada">
            <OrderTicket
              stage="aceito"
              number={1047}
              elapsedLabel="7 min"
              elapsedMinutes={7}
              windowMinutes={null}
              timeLabel="20:55"
              customer="Camila Souza"
              total="R$ 98,00"
              tags={['Retirada', 'Crédito']}
              onOpen={() => {}}
            />
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
            <button type="button" className="gal__theme" onClick={() => setFolha(true)}>
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
