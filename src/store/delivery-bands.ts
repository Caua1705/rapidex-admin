/**
 * ============================================================================
 * AS FAIXAS DE PRAZO POR DISTÂNCIA — e elas são TETOS, não intervalos
 * ============================================================================
 *
 * Vale a PRIMEIRA faixa, em ordem crescente, cujo teto alcança a distância
 * (`<=`, então a distância exata do teto cai na própria faixa). Só o teto é
 * gravado, e a ausência de um piso é decisão do backend: com piso daria para
 * cadastrar 0–5 e 6–10 e deixar o endereço de 5,4 km sem faixa nenhuma — um
 * buraco que aparece no endereço de um cliente específico e some quando alguém
 * vai conferir. Com teto, a cobertura sai de graça.
 *
 * OS MINUTOS SÃO O DESLOCAMENTO, NÃO O PRAZO TOTAL. A faixa substitui o tempo
 * do Google, que é tempo de DIRIGIR — ele não inclui ensacar o pedido, a
 * segunda entrega da mesma corrida, estacionar e subir escada, e é por isso que
 * o prazo saía curto justamente no bairro longe. O PREPARO CONTINUA SOMANDO por
 * cima, e isso não é detalhe: é ele que o botão de "+10 minutos" do almoço
 * ajusta, e uma faixa que respondesse pelo prazo todo desligaria aquele botão
 * para entrega bem no horário em que ele existe para ser usado.
 *
 * ELAS NÃO SÃO O `estimated_delivery_time_min/max` DE GERAL. Aquele é o rótulo
 * de VITRINE, publicado no cardápio antes de existir endereço, digitado pelo
 * lojista e nunca recalculado a partir daqui. Isto é o prazo REAL de um
 * endereço concreto. Confundir os dois é o defeito mais fácil desta tela, e é
 * por isso que a seção diz qual é qual.
 *
 * SEM HERANÇA NENHUMA, ao contrário dos termos comerciais: a faixa mede o tempo
 * entre a porta DAQUELA loja e a porta do cliente, e duas lojas da mesma marca
 * em pontas opostas da cidade não têm faixa em comum.
 */
import type { DeliveryTimeBand, DeliveryTimeBandInput } from '../api/types';

/** Uma linha da tabelinha, como ela vive no formulário: texto, não número. */
export type BandDraft = {
  /** Chave estável de renderização — a distância muda enquanto se digita. */
  key: string;
  maxDistanceKm: string;
  timeMin: string;
  timeMax: string;
};

let contador = 0;
export function novaFaixa(): BandDraft {
  contador += 1;
  return { key: `faixa-${contador}`, maxDistanceKm: '', timeMin: '', timeMax: '' };
}

/** O que veio do backend vira rascunho, já na ordem em que a regra as lê. */
export function draftFromBands(bands: readonly DeliveryTimeBand[]): BandDraft[] {
  return [...bands]
    .sort((a, b) => a.max_distance_km - b.max_distance_km)
    .map((band, indice) => ({
      key: `gravada-${band.id ?? indice}`,
      maxDistanceKm: formatKm(band.max_distance_km),
      timeMin: String(band.delivery_time_min),
      timeMax: String(band.delivery_time_max),
    }));
}

/** "7,5" — vírgula, como o lojista digita; sem casa decimal quando é inteiro. */
export function formatKm(km: number): string {
  return Number.isInteger(km) ? String(km) : String(km).replace('.', ',');
}

function parseKm(raw: string): number | null {
  const limpo = raw.trim().replace(',', '.');
  if (limpo === '') return null;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

function parseMinutos(raw: string): number | null {
  const limpo = raw.trim();
  if (limpo === '') return null;
  const valor = Number(limpo);
  return Number.isInteger(valor) ? valor : null;
}

export type BandsResult =
  { ok: true; bands: DeliveryTimeBandInput[] } | { ok: false; message: string };

/**
 * A tabelinha inteira vira o corpo do PUT — ou a razão de não virar.
 *
 * LISTA VAZIA É VÁLIDA e não significa "sem entrega": significa que o prazo
 * volta a sair do tempo do Google, como antes desta tabela existir. É como se
 * desfaz a configuração, e por isso ela passa daqui sem reclamação.
 *
 * As faixas saem ORDENADAS por teto. O backend lê a primeira que alcança, então
 * a ordem já decide qual vale — mandar fora de ordem funcionaria, e deixaria a
 * tabela na tela numa ordem que não é a da regra.
 */
export function bandsFromDraft(linhas: readonly BandDraft[]): BandsResult {
  const preenchidas = linhas.filter(
    (linha) =>
      linha.maxDistanceKm.trim() !== '' ||
      linha.timeMin.trim() !== '' ||
      linha.timeMax.trim() !== '',
  );

  const bands: DeliveryTimeBandInput[] = [];

  for (const linha of preenchidas) {
    const km = parseKm(linha.maxDistanceKm);
    if (km === null || km <= 0) {
      return { ok: false, message: 'Cada faixa precisa de uma distância maior que zero.' };
    }

    const min = parseMinutos(linha.timeMin);
    const max = parseMinutos(linha.timeMax);
    if (min === null || max === null || min < 0 || max < 0) {
      return {
        ok: false,
        message: `Faixa até ${formatKm(km)} km: informe os dois tempos, em minutos inteiros.`,
      };
    }
    if (min > max) {
      return {
        ok: false,
        message: `Faixa até ${formatKm(km)} km: o tempo mínimo não pode ser maior que o máximo.`,
      };
    }

    /*
     * DOIS TETOS IGUAIS NÃO SÃO AMBIGUIDADE DE APRESENTAÇÃO: são duas respostas
     * para a mesma distância, e qual vale mudaria entre duas consultas
     * idênticas. O backend tem UNIQUE para isso; aqui o lojista vê o problema
     * com as duas linhas na frente dele, em vez de um 409 depois de salvar.
     */
    if (bands.some((band) => Number(band.max_distance_km) === km)) {
      return {
        ok: false,
        message: `Há duas faixas até ${formatKm(km)} km — cada distância só pode cair numa.`,
      };
    }

    bands.push({ max_distance_km: km, delivery_time_min: min, delivery_time_max: max });
  }

  bands.sort((a, b) => Number(a.max_distance_km) - Number(b.max_distance_km));
  return { ok: true, bands };
}

/**
 * QUAL FAIXA RESPONDE POR ESTA DISTÂNCIA — a mesma regra do backend, para a
 * prévia da tela.
 *
 * `null` quando nenhuma alcança, e esse é um estado VÁLIDO: além do último teto
 * vale o tempo do Google, como antes da tabela existir. Não confundir com
 * `delivery_max_distance_km`, que é até onde a filial ATENDE — são perguntas
 * diferentes e não se misturam.
 */
export function faixaPara(
  bands: readonly DeliveryTimeBandInput[],
  km: number,
): DeliveryTimeBandInput | null {
  const ordenadas = [...bands].sort(
    (a, b) => Number(a.max_distance_km) - Number(b.max_distance_km),
  );
  return ordenadas.find((band) => km <= Number(band.max_distance_km)) ?? null;
}
