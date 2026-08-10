import { useState } from 'react';

import { useTheme } from '../theme/theme-context';
import {
  Breadcrumb,
  Checkbox,
  Field,
  FieldRow,
  Input,
  RadioGroup,
  RangeInput,
  SearchField,
  Select,
  Spinner,
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
        <h1 className="t-screen">Design system</h1>
        <p className="t-hint">
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
            <Field label="Filial" disabled hint="Escolha uma filial no topo.">
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
        <h2 className="t-card">{titulo}</h2>
        {nota ? <p className="t-hint">{nota}</p> : null}
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
      <p className="t-eyebrow">{rotulo}</p>
      <div className="gal__palco">{children}</div>
    </div>
  );
}
