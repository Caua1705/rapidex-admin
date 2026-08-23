import { useEffect, useState } from 'react';

import { Field } from '../ds/Field';
import { Textarea } from '../ds/Textarea';
import {
  corte,
  DESCRICAO_MAX,
  draftDoPerfil,
  estadoDoTexto,
  NOTAS_MAX,
  problemaDoPerfil,
  profilePayload,
  PROFILE_VAZIO,
  type ProfileDraft,
} from './restaurant-profile';
import { SaveBar } from './SaveBar';
import { useRestaurantProfile } from './useRestaurantProfile';

/**
 * ============================================================================
 * MARCA — quem a casa é, e não com que números ela opera
 * ============================================================================
 *
 * POR QUE ELA NÃO É UM BLOCO DENTRO DE GERAL, que era o lugar óbvio:
 *
 * 1. É OUTRO REGIME. Geral inteira é `PATCH /admin/settings`, que grava
 *    `restaurant_settings` — o PADRÃO que cada filial herda e sobrescreve em
 *    Valores. Isto é `PATCH /admin/restaurant`, que grava `restaurants` — a
 *    marca, que filial nenhuma herda porque ela é uma só. É a mesma decisão que
 *    separou as faixas de prazo da barra de salvar da aba de Entrega: misturar
 *    dois regimes na mesma tela é o jeito mais barato de fazer alguém preencher
 *    o campo errado.
 *
 * 2. UMA SEÇÃO, UM DESTINO, UMA BARRA. Com os dois PATCH na mesma `SaveBar`
 *    haveria quatro desfechos, e em dois deles "Alterações salvas." seria
 *    mentira sobre metade do formulário — o lojista sairia da tela achando que
 *    gravou os dois.
 *
 * 3. `name` E `slug` PRECISAM DE CASA. Entre "Valor mínimo do pedido" e "Taxa
 *    de serviço", a URL pública do cardápio é um intruso.
 *
 * 4. ELA VAI CRESCER. O contrato diz onde a capa e as cores entram quando a
 *    tela que as edita existir: aqui. Em Geral, isso vira gaveta.
 *
 * ----------------------------------------------------------------------------
 * O DESENHO — os dois campos precisam se distinguir SEM documentação
 * ----------------------------------------------------------------------------
 *
 * Eles eram o mesmo campo até hoje. Quem abre a tela e lê os dois lado a lado
 * tem de entender a diferença ali, e ela é dita por quatro canais ao mesmo
 * tempo, nenhum sozinho:
 *
 *   - o RÓTULO na coluna de 180px, com o público logo abaixo dele: "o cliente
 *     lê no cardápio" contra "só o assistente lê";
 *   - a AJUDA, uma linha em cada, e a do assistente diz o que ela precisa dizer
 *     — não é anúncio, é onde ele trabalha;
 *   - o EXEMPLO dentro da caixa vazia: a mesma churrascaria escrita das duas
 *     maneiras, que é a forma mais curta de mostrar a diferença;
 *   - o TAMANHO da caixa, que é o do texto que cabe nela — cinco linhas contra
 *     três, 1000 contra 300.
 */
export function BrandTab() {
  const profile = useRestaurantProfile();
  const [draft, setDraft] = useState<ProfileDraft>(PROFILE_VAZIO);
  const [baseline, setBaseline] = useState<ProfileDraft>(PROFILE_VAZIO);
  const [problem, setProblem] = useState<string | null>(null);

  const perfil = profile.profile;

  useEffect(() => {
    if (!perfil) return;
    const next = draftDoPerfil(perfil);
    setDraft(next);
    setBaseline(next);
  }, [perfil]);

  const descricao = estadoDoTexto(draft.descricao, baseline.descricao, DESCRICAO_MAX);
  const notas = estadoDoTexto(draft.notas, baseline.notas, NOTAS_MAX);

  /*
   * O SUJO É O CORPO. Uma segunda conta de "há algo a salvar" divergiria da que
   * monta o PATCH no dia em que uma das duas ganhasse um campo.
   */
  const body = profilePayload(draft, baseline);

  function patch(change: Partial<ProfileDraft>) {
    setDraft((current) => ({ ...current, ...change }));
    setProblem(null);
  }

  async function handleSave() {
    const problema = problemaDoPerfil(draft, baseline);
    if (problema) return setProblem(problema);
    if (!body) return;

    if (await profile.save(body)) setBaseline(draft);
  }

  if (profile.isLoading) return <p className="muted store__loading">Carregando a marca…</p>;

  if (!perfil)
    return (
      <p className="alert alert--error" role="alert" data-testid="store-error">
        {profile.errorMessage ?? 'Não foi possível carregar o perfil do restaurante.'}
      </p>
    );

  return (
    <form
      className="store-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <div className="store-form__folha">
        {/*
          A IDENTIFICAÇÃO É LEITURA, e é assim que ela tem de PARECER: uma lista
          de definição, não três campos desabilitados. Campo desabilitado
          convida ao clique e não explica a recusa — a mesma regra do botão que
          some em vez de ficar inerte.
        */}
        <section className="store-form__group">
          <div className="marca__rotulo">
            <h3 className="store-form__heading">Identificação</h3>
            <p className="t-aux marca__publico">o cliente vê o nome e o endereço</p>
          </div>

          <div className="marca__bloco">
            <dl className="store-form__leitura" data-testid="marca-identidade">
              <dt>Nome</dt>
              <dd data-testid="marca-nome">{perfil.name}</dd>

              <dt>Endereço do cardápio</dt>
              {/*
                O slug aparece como CAMINHO, e não como um endereço completo: o
                painel não conhece o domínio da vitrine, e escrever um seria
                inventar um link que talvez não abra.
              */}
              <dd data-testid="marca-slug">/{perfil.slug}</dd>

              <dt>Código</dt>
              <dd className="faint" data-testid="marca-id">
                {perfil.id}
              </dd>
            </dl>

            <p className="t-aux marca__nota">
              O endereço do cardápio não se edita aqui, e não é esquecimento: ele é a URL pública da
              loja — a única coisa que o cliente tem salva. Trocá-lo quebraria todo link que já
              existe, em silêncio e sem redirecionamento. O código serve para o suporte.
            </p>
          </div>
        </section>

        {/*
          A VITRINE. Ela sai em `RestaurantPublicResponse`: o cliente a lê no
          cardápio, antes de decidir pedir. Anúncio aqui é o uso certo, e é o
          que a ajuda diz — porque o campo de baixo diz o contrário.
        */}
        <section className="store-form__group">
          <div className="marca__rotulo">
            <h3 className="store-form__heading">Descrição</h3>
            <p className="t-aux marca__publico">o cliente lê no cardápio</p>
          </div>

          <div className="marca__bloco">
            <div className="marca__campo">
              <Field
                label="Descrição"
                hideLabel
                hint="Sai no cardápio, para o cliente, antes de ele pedir. É a vitrine da casa — anúncio aqui é o uso certo."
                error={descricao.bloqueia ? `${corte(descricao.excedente)}.` : null}
              >
                {/*
                  SEM `maxLength`, e é de propósito — ver `restaurant-profile.ts`.
                  Ele impede digitar mas não impede colar, e colar 1200 num campo
                  de 1000 descarta 200 em silêncio, que é a queixa que separou
                  estes dois campos.
                */}
                <Textarea
                  rows={5}
                  value={draft.descricao}
                  placeholder="Churrascaria de bairro desde 1998. Rodízio no almoço e carne na brasa até meia-noite."
                  onValueChange={(valor) => patch({ descricao: valor })}
                  data-testid="marca-descricao"
                />
              </Field>

              <Contador estado={descricao} teto={DESCRICAO_MAX} testId="marca-descricao-contador" />

              {descricao.legado ? (
                <Legado excedente={descricao.excedente} teto={DESCRICAO_MAX} />
              ) : null}
            </div>
          </div>
        </section>

        {/*
          O PROMPT. Entra no contexto do assistente de IA como "Sobre a casa: …"
          e não sai em resposta pública nenhuma — não há fallback para a
          descrição: vazio aqui é um assistente sem essa linha, e não um
          assistente lendo a vitrine.
        */}
        <section className="store-form__group">
          <div className="marca__rotulo">
            <h3 className="store-form__heading">Anotações para o assistente</h3>
            <p className="t-aux marca__publico">só o assistente lê</p>
          </div>

          <div className="marca__bloco">
            <div className="marca__campo">
              <Field
                label="Anotações para o assistente"
                hideLabel
                hint="Não é anúncio: é onde o assistente de IA trabalha — o que a casa faz e o que ela não faz, para ele não inventar no atendimento."
                error={notas.bloqueia ? `${corte(notas.excedente)}.` : null}
              >
                <Textarea
                  rows={3}
                  value={draft.notas}
                  /*
                    A MESMA CHURRASCARIA DO CAMPO DE CIMA, escrita da outra
                    maneira. Dois exemplos de casas diferentes ensinariam duas
                    casas; o mesmo restaurante nos dois campos ensina a
                    diferença entre os campos, que é o que a tela precisa.
                  */
                  placeholder="Churrascaria. Picanhas, carnes por quilo e executivos no almoço."
                  onValueChange={(valor) => patch({ notas: valor })}
                  data-testid="marca-notas"
                />
              </Field>

              <Contador estado={notas} teto={NOTAS_MAX} testId="marca-notas-contador" />

              {notas.legado ? <Legado excedente={notas.excedente} teto={NOTAS_MAX} /> : null}
            </div>
          </div>
        </section>
      </div>

      <SaveBar
        isSaving={profile.isSaving}
        isDirty={body !== null}
        savedAt={profile.savedAt}
        errorMessage={problem ?? profile.errorMessage}
        onSave={() => void handleSave()}
        onReset={() => {
          setDraft(baseline);
          setProblem(null);
        }}
      />
    </form>
  );
}

/**
 * O CONTADOR, e ele acende ao passar do teto.
 *
 * Ele mora DENTRO do mesmo item da grade que a caixa (`marca__campo`): solto
 * como irmão, `store-form__fields` o trataria como um segundo campo e o poria
 * na coluna ao lado — foi o que já aconteceu com o do rodapé da comanda.
 *
 * A cor não é o único canal: o número passa do teto por escrito, e o campo
 * ganha a mensagem de erro quando a gravação está travada.
 */
function Contador({
  estado,
  teto,
  testId,
}: {
  estado: { contagem: number; excedente: number };
  teto: number;
  testId: string;
}) {
  const acima = estado.excedente > 0;
  return (
    <div className="marca__meta">
      <span className={`tnum ${acima ? 'marca__acima' : 'faint'}`} data-testid={testId}>
        {estado.contagem}/{teto}
      </span>
    </div>
  );
}

/**
 * O TEXTO QUE JÁ CHEGOU ACIMA DO TETO.
 *
 * Os tetos existem só no corpo do PATCH; a resposta não os declara. Um texto
 * gravado antes de os dois campos se separarem chega aqui maior que o teto sem
 * ninguém ter digitado nada — e a tela não pode nem acusar o lojista de um erro
 * que não é dele, nem fingir que está tudo certo.
 *
 * Enquanto ninguém o toca ele fica FORA do corpo (edição parcial), continua no
 * ar como está e não trava a gravação do outro campo. Esta linha é a metade que
 * falta: ela diz que ele está acima e quantos caracteres faltam cortar.
 *
 * ELA MORA DENTRO DE `marca__campo`, com o contador: é uma frase sobre AQUELE
 * texto, e solta na largura da coluna ela correria 1300px ao lado de uma caixa
 * de 68 caracteres — larga o bastante para parecer um aviso da tela inteira.
 */
function Legado({ excedente, teto }: { excedente: number; teto: number }) {
  return (
    <p className="store-form__warn" data-testid="marca-legado">
      Este texto já veio acima do teto de {teto} caracteres. Ele continua no ar como está — para
      gravar qualquer mudança nele, {corte(excedente)}.
    </p>
  );
}
