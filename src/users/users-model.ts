/**
 * ============================================================================
 * AS GUARDAS DA EQUIPE, ANTECIPADAS — e o rascunho do formulário
 * ============================================================================
 *
 * O backend recusa três coisas com 400, e as três são o mesmo buraco por
 * caminhos diferentes: um restaurante sem dono ativo. Chega-se lá desativando a
 * si mesmo, desativando o último dono e REBAIXANDO o último dono — o terceiro é
 * o que se esquece, porque não parece uma remoção: a pessoa continua ativa, só
 * deixou de ser dona, e o restaurante fica sem quem cadastre gente do mesmo
 * jeito.
 *
 * ESTA TELA IMPEDE ANTES, COM O MOTIVO ESCRITO. Não é desconfiança do backend —
 * ele continua sendo quem recusa de verdade. É que oferecer o botão para depois
 * responder "não pode" é ensinar um caminho e fechá-lo na cara de quem o
 * seguiu, e o conserto de um restaurante sem dono ativo é `docker exec`: o
 * exato trabalho que estas rotas existem para eliminar.
 *
 * A CONTAGEM DE DONOS SAI DA LISTA QUE JÁ ESTÁ NA TELA, e é a mesma conta do
 * backend (`count_active_owners`): `GET /admin/users` devolve a equipe inteira,
 * ativos e inativos, sem paginação — então a lista carregada É o universo, e
 * não uma amostra dele. Se um dia a rota ganhar recorte, esta função passa a
 * mentir, e é por isso que ela está escrita aqui em vez de espalhada em três
 * `filter` dentro da página.
 *
 * UMA GUARDA É NOSSA, e o backend não a tem: redefinir a PRÓPRIA senha. A rota
 * aceita — `_get_person` só confere que é uma pessoa deste restaurante — e o
 * resultado é o dono se expulsar do painel, com uma senha de 20 caracteres na
 * mão e `must_change_password` ligado em si mesmo. Quem quer trocar a própria
 * senha usa "Trocar minha senha", no menu da conta, que é a rota certa
 * (`PATCH /admin/auth/password`) e pede a senha atual.
 */
import { ApiError, messageFromUnknownError } from '../api/errors';
import type {
  AdminUserCreate,
  AdminUserDetail,
  AdminUserUpdate,
  Branch,
  PapelDePessoa,
} from '../api/types';
import { ROLE_LABELS } from '../auth/role-labels';
import { branchName } from '../layout/branch-heading';

/* ==========================================================================
 * AS GUARDAS
 * ======================================================================= */

/** Os donos que sustentam o restaurante hoje. A mesma conta do backend. */
export function donosAtivos(usuarios: readonly AdminUserDetail[]): number {
  return usuarios.filter((usuario) => usuario.role === 'owner' && usuario.is_active).length;
}

/**
 * Por que este usuário não pode ser desativado — ou `null` quando pode.
 *
 * A ORDEM DAS DUAS RAZÕES IMPORTA: o dono único que também é você mesmo cai na
 * primeira, e é a certa das duas. "Você não pode desativar a própria conta"
 * responde ao que a pessoa acabou de tentar; "é o único proprietário" a
 * mandaria procurar outro dono que ela não tem como criar depois de sair.
 */
export function motivoParaNaoDesativar(
  alvo: AdminUserDetail,
  meuId: string | null,
  usuarios: readonly AdminUserDetail[],
): string | null {
  if (alvo.id === meuId) {
    return 'Ninguém desativa a própria conta — não sobraria quem a reativasse. Peça a outro proprietário.';
  }
  if (alvo.role === 'owner' && alvo.is_active && donosAtivos(usuarios) <= 1) {
    return 'Este é o único proprietário ativo. Sem ele, ninguém consegue cadastrar gente nem reativar contas.';
  }
  return null;
}

/**
 * Por que o papel deste usuário não pode mudar — ou `null` quando pode.
 *
 * Só o último dono ATIVO é intocável. Rebaixar um dono já desativado passa: ele
 * não sustenta nada hoje, e o backend concorda (`_ensure_keeps_an_active_owner`
 * sai cedo quando `is_active` é falso).
 */
export function motivoParaNaoRebaixar(
  alvo: AdminUserDetail,
  usuarios: readonly AdminUserDetail[],
): string | null {
  if (alvo.role === 'owner' && alvo.is_active && donosAtivos(usuarios) <= 1) {
    return 'Este é o único proprietário ativo. Promova outra pessoa a proprietário antes de mudar o cargo dele.';
  }
  return null;
}

/**
 * Por que não redefinir a senha deste usuário — ou `null` quando pode.
 *
 * ESTA É A GUARDA QUE O BACKEND NÃO TEM, e sem ela o caminho existe: redefinir
 * a própria senha grava `password_changed_at` (que revoga o token desta aba) e
 * liga `must_change_password` em você mesmo. O painel se fecha no clique
 * seguinte, e a única saída é digitar os 20 caracteres que acabaram de aparecer
 * na tela — se você os tiver copiado.
 */
export function motivoParaNaoRedefinirSenha(
  alvo: AdminUserDetail,
  meuId: string | null,
): string | null {
  if (alvo.id === meuId) {
    return 'Para trocar a sua própria senha use "Trocar minha senha", no menu da conta — lá você escolhe a senha em vez de receber uma temporária.';
  }
  return null;
}

/* ==========================================================================
 * A SITUAÇÃO DE CADA LINHA
 * ======================================================================= */

export type Situacao = 'ativo' | 'senha-pendente' | 'inativo';

export const SITUACAO_LABEL: Record<Situacao, string> = {
  ativo: 'Ativo',
  'senha-pendente': 'Senha temporária',
  inativo: 'Desativado',
};

/**
 * As três situações de uma linha, em ordem de precedência.
 *
 * DESATIVADO VENCE A SENHA PENDENTE: quem foi desativado antes de entrar pela
 * primeira vez não está esperando trocar senha nenhuma — está fora. Mostrar
 * "senha temporária" ali faria a linha parecer uma pendência a resolver, quando
 * o que ela pede é uma decisão de reativar ou não.
 *
 * "Senha temporária" NÃO é `.tag--alerta`. Ela é o estado normal de quem acabou
 * de ser cadastrado e ainda não entrou — o alerta do sistema é para o estado
 * que ninguém escolheu, e este foi escolhido por quem cadastrou.
 */
export function situacaoDe(usuario: AdminUserDetail): Situacao {
  if (!usuario.is_active) return 'inativo';
  if (usuario.must_change_password) return 'senha-pendente';
  return 'ativo';
}

/* ==========================================================================
 * A FILIAL DE CADA PESSOA
 * ======================================================================= */

/** O que "todas as filiais" se chama na tela. Vale para leitura e para escrita. */
export const TODAS_AS_FILIAIS = '';

/**
 * O rótulo da filial de um usuário.
 *
 * `branch_id` NULO É "TODAS AS FILIAIS DO RESTAURANTE", nunca "sem filial" — é
 * a regra de `AdminScope`, e ela vale para gerente e atendente do mesmo jeito.
 * Escrever "—" ali diria o contrário do que o campo significa: quem tem nulo
 * enxerga MAIS, não menos.
 *
 * NO DONO O CAMPO NÃO É LIDO POR NINGUÉM: `build_admin_scope` ignora a filial
 * de quem é dono ("dono não se prende a filial"). Mostrar o nome de uma loja na
 * linha dele seria anunciar um limite que não existe.
 *
 * Filial que não está na lista do token vira o próprio id abreviado? Não — vira
 * "outra filial". O dono enxerga todas as do restaurante, então isto só
 * acontece com dado velho, e um UUID cru numa coluna não ajuda ninguém.
 */
export function filialLabel(
  usuario: AdminUserDetail,
  branches: readonly Branch[],
): string {
  if (usuario.role === 'owner') return 'Todas as filiais';
  if (!usuario.branch_id) return 'Todas as filiais';
  const filial = branches.find((branch) => branch.id === usuario.branch_id);
  /* `branchName` é o MESMO rótulo do cabeçalho e do seletor do topo: quem
     escolheu "Centro" ali precisa ler "Centro" aqui, e não o nome interno. */
  return filial ? branchName(filial) : 'Outra filial';
}

/* ==========================================================================
 * O RASCUNHO DO FORMULÁRIO
 * ======================================================================= */

export type UserDraft = {
  /** Nulo = cadastro novo. */
  id: string | null;
  name: string;
  email: string;
  role: PapelDePessoa;
  /** Vazio = todas as filiais do restaurante (o `null` do contrato). */
  branchId: string;
  isActive: boolean;
};

export type UserField = 'name' | 'email' | 'role' | 'branchId';

/**
 * O cadastro novo nasce ATENDENTE, e não gerente nem proprietário.
 *
 * É o papel de quem esta tela existe para criar: a pessoa do balcão que hoje
 * usa a senha do dono. O papel mais alcance como padrão seria o defeito
 * clássico de tela de permissão — a maioria dos cadastros sai como veio, e o
 * padrão é o que decide o que a loja inteira vira.
 */
export function rascunhoNovo(branchId: string): UserDraft {
  return {
    id: null,
    name: '',
    email: '',
    role: 'attendant',
    branchId,
    isActive: true,
  };
}

export function rascunhoDe(usuario: AdminUserDetail): UserDraft {
  return {
    id: usuario.id,
    name: usuario.name,
    email: usuario.email,
    role: (usuario.role as PapelDePessoa) ?? 'attendant',
    branchId: usuario.branch_id ?? TODAS_AS_FILIAIS,
    isActive: usuario.is_active,
  };
}

/**
 * A FILIAL QUE VAI NO CORPO — e no dono ela é sempre nula.
 *
 * O backend aceitaria a filial num dono e a ignoraria (`build_admin_scope` não
 * a lê nesse papel). O problema é o dia seguinte: rebaixado a gerente, ele
 * apareceria preso a uma loja que ninguém escolheu para ele, porque o valor
 * ficou gravado desde o cadastro. Gravar nulo é dizer no banco o que a tela
 * mostra ("Todas as filiais").
 */
function filialDoCorpo(draft: UserDraft): string | null {
  if (draft.role === 'owner') return null;
  return draft.branchId === TODAS_AS_FILIAIS ? null : draft.branchId;
}

export function bodyDeCriacao(draft: UserDraft): AdminUserCreate {
  return {
    name: draft.name.trim(),
    /* O backend normaliza (minúsculas, sem espaço nas pontas) e o UNIQUE é
       sobre `lower(email)`. Mandar já normalizado faz a tela comparar a mesma
       coisa que o banco compara — e evita o 409 por um espaço colado. */
    email: draft.email.trim().toLowerCase(),
    role: draft.role,
    branch_id: filialDoCorpo(draft),
  };
}

/**
 * O corpo da edição: SÓ O QUE MUDOU, e `null` quando o vazio é a escolha.
 *
 * O backend faz `model_dump(exclude_unset=True)`, então campo ausente é campo
 * não tocado. Mandar o objeto inteiro faria um conserto de nome reenviar papel,
 * filial e situação por cima do que outra aba acabou de gravar — é a mesma
 * decisão do interruptor de campanha em Cupons.
 *
 * A distinção entre AUSENTE e `null` é real aqui: ausente é "não mexe na
 * filial", `null` é "esta pessoa passa a enxergar todas". Um corpo que
 * omitisse o campo para dizer a segunda coisa não diria nada.
 *
 * Devolve `null` quando nada mudou — e quem chama usa isso para não gastar uma
 * chamada, em vez de mandar `{}` e receber a mesma ficha de volta.
 */
export function bodyDeEdicao(
  draft: UserDraft,
  original: AdminUserDetail,
): AdminUserUpdate | null {
  const body: AdminUserUpdate = {};

  const nome = draft.name.trim();
  if (nome !== original.name) body.name = nome;
  if (draft.role !== original.role) body.role = draft.role;
  if (draft.isActive !== original.is_active) body.is_active = draft.isActive;

  const filial = filialDoCorpo(draft);
  if (filial !== (original.branch_id ?? null)) body.branch_id = filial;

  return Object.keys(body).length > 0 ? body : null;
}

/* ==========================================================================
 * A VALIDAÇÃO DO FORMULÁRIO
 * ======================================================================= */

const TETO_DO_NOME = 200;
const TETO_DO_EMAIL = 255;

/**
 * O E-MAIL É VALIDADO AQUI PORQUE O BACKEND NÃO O VALIDA.
 *
 * `AdminUserCreate.email` é `str` com `min_length=3` e mais nada — não é
 * `EmailStr`. Um "joao" passa, grava, e vira uma conta que ninguém consegue
 * usar: o campo é a metade da credencial de login, e não há e-mail de
 * confirmação para descobrir o erro depois (foi decidido contra o convite por
 * e-mail).
 *
 * A forma é a mínima defensável — algo, arroba, algo, ponto, algo — e de
 * propósito: uma regex ambiciosa recusa endereço válido, e recusar o e-mail
 * real de alguém numa tela sem segunda via é pior que aceitar um improvável.
 */
const FORMA_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarRascunho(draft: UserDraft): Partial<Record<UserField, string>> {
  const campos: Partial<Record<UserField, string>> = {};

  const nome = draft.name.trim();
  if (nome === '') campos.name = 'Diga o nome de quem vai usar esta conta.';
  else if (nome.length > TETO_DO_NOME) campos.name = `No máximo ${TETO_DO_NOME} caracteres.`;

  const email = draft.email.trim();
  if (email === '') campos.email = 'O e-mail é com o que a pessoa entra no painel.';
  else if (email.length > TETO_DO_EMAIL) campos.email = `No máximo ${TETO_DO_EMAIL} caracteres.`;
  else if (!FORMA_DE_EMAIL.test(email)) {
    campos.email = 'Este endereço não parece um e-mail. Ele é o login da pessoa — sem ele, ninguém entra.';
  }

  return campos;
}

/* ==========================================================================
 * O QUE A TELA ESCREVE SOBRE O QUE CADA CARGO ALCANÇA
 * ======================================================================= */

/**
 * Uma linha por cargo, dita pelo que a pessoa FAZ — não pelas rotas.
 *
 * `Record<PapelDePessoa, string>` pelo mesmo motivo de `ROLE_LABELS`: papel
 * novo no contrato acende no `npm run typecheck` em vez de aparecer no seletor
 * sem explicação.
 *
 * ELAS RESUMEM, E O RESUMO É HONESTO ATÉ ONDE VAI. A divisão real são 78 rotas
 * em três conjuntos, e nenhuma frase de uma linha dá conta disso; o que estas
 * fazem é dizer o que muda no dia de quem vai usar a conta. Quem quiser a regra
 * exata de um botão tem o próprio botão: ele não aparece para quem não pode.
 */
export const PAPEL_RESUMO: Record<PapelDePessoa, string> = {
  owner: 'Tudo, inclusive preço, cupom, cashback e esta tela.',
  manager: 'A loja inteira menos dinheiro do restaurante: cardápio, horários e cancelamento.',
  attendant: 'O balcão: receber e avançar pedidos, marcar item esgotado, pausar a entrega.',
};

/** O rótulo e o resumo juntos, na ordem em que o seletor os oferece. */
export function opcoesDePapel(): readonly { value: PapelDePessoa; label: string }[] {
  return (Object.keys(ROLE_LABELS) as PapelDePessoa[]).map((papel) => ({
    value: papel,
    label: ROLE_LABELS[papel],
  }));
}

/* ==========================================================================
 * O QUE VOLTOU DO BACKEND → O CAMPO A DESTACAR
 * ======================================================================= */

export type ErrosDoUsuario = {
  campos: Partial<Record<UserField, string>>;
  /** O que não pertence a campo nenhum. Vai para o aviso do rodapé. */
  geral: string | null;
};

/**
 * A falha da API traduzida para o formulário.
 *
 * TRÊS CASOS, E SÓ UM DELES TEM CAMPO:
 *
 *   409  e-mail repetido. É o erro mais provável desta tela, e o único que o
 *        formulário consegue apontar. A MENSAGEM DO BACKEND PASSA DIRETO, sem
 *        tradução nossa — é a regra da skill de API, e ela vale mesmo com o
 *        texto vindo sem acento ("Este e-mail ja esta em uso"): reescrevê-lo
 *        aqui criaria a segunda versão da mesma frase, e a nossa envelheceria
 *        sozinha no dia em que o backend mudasse a dele.
 *   404  filial que não é deste restaurante. Não tem como acontecer pelo
 *        seletor (ele só oferece as do token), então é dado velho de uma aba
 *        aberta há muito tempo — vai para o aviso geral, que é onde cabe.
 *   400  as três guardas do dono. A tela impede antes, então chegar aqui
 *        significa que a lista na mão estava velha: outra aba desativou o
 *        outro dono no meio do caminho. A frase do backend é a certa, e ela
 *        também passa direto.
 *
 * O 422 de `print_agent` não está aqui porque o seletor não oferece esse papel:
 * ele não é opção, então não há campo que o receba.
 */
export function errosDoUsuario(erro: unknown): ErrosDoUsuario {
  if (erro instanceof ApiError && erro.status === 409) {
    return { campos: { email: erro.message }, geral: null };
  }
  return { campos: {}, geral: messageFromUnknownError(erro) };
}
