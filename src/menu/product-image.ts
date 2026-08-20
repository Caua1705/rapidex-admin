/**
 * A foto do produto, preparada NO NAVEGADOR antes de subir.
 *
 * POR QUE O TRABALHO É AQUI E NÃO NO BACKEND
 *
 * `POST /admin/products/{id}/image` **não converte e não redimensiona**. Ele
 * confere o tamanho (3 MiB) e o tipo pelos BYTES do arquivo — nunca pelo
 * `content-type` declarado, que o cliente escolhe — e grava o conteúdo no
 * bucket exatamente como veio (`AdminMenuService.upload_product_image`; não há
 * Pillow no projeto). Quem serve aquele objeto é o cardápio público.
 *
 * A consequência prática: um JPEG de 2,8 MB tirado de um celular passa na
 * validação e vai inteiro para o bucket, e o cliente final baixa 2,8 MB para
 * ver uma miniatura. Numa lista de sessenta itens isso é o cardápio inteiro
 * pesando dezenas de megabytes no 4G de quem está com fome.
 *
 * Então o painel entrega ao backend um arquivo que já está pronto: recortado
 * na proporção certa, reduzido e recodificado em WebP. Isso não depende de
 * mudança nenhuma no servidor — e continua correto no dia em que o backend
 * passar a converter também, porque converter o que já está pequeno é barato.
 *
 * A GEOMETRIA MORA AQUI E É PURA. O canvas só desenha o retângulo que estas
 * funções calcularam: `sourceRectFor` e `clampOffset` são testáveis sem DOM,
 * que é o que permite provar o recorte sem depender de jsdom ter canvas.
 */

/**
 * O limite do backend, em bytes (`settings.MAX_IMAGE_UPLOAD_BYTES`).
 *
 * Repetido aqui para o painel poder recusar ANTES de gastar o upload — não
 * para substituir a régua do servidor, que continua sendo a que vale.
 */
export const MAX_UPLOAD_BYTES = 3_145_728;

/**
 * O lado da imagem que sobe, em pixels.
 *
 * 1080 e não 2000: a maior aparição da foto é o topo do item no cardápio do
 * cliente, e num celular retina 1080 já cobre. Cada dobra desse número
 * quadruplica o peso do arquivo para um ganho que ninguém vê.
 */
export const OUTPUT_EDGE = 1080;

/**
 * A PROPORÇÃO É FIXA E É 1:1.
 *
 * A miniatura da lista é quadrada e a foto do cardápio é maior, mas as duas
 * saem do MESMO objeto no bucket — só há um `image_path` por produto. Sem
 * recorte, uma foto vertical de celular (9:16) entra no slot quadrado cortada
 * pelo meio: o prato sai de cena e sobra a toalha da mesa. Escolher o quadrado
 * aqui é o que faz o lojista decidir qual pedaço importa, em vez de o
 * `object-fit` decidir por ele.
 */
export const ASPECT = 1;

/** WebP a 0,82: onde a perda ainda não se vê e o arquivo já caiu muito. */
const WEBP_QUALITY = 0.82;

/** O que o backend aceita, conferido lá pelos bytes (`src/utils/images.py`). */
export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type Offset = { x: number; y: number };

export type CropState = {
  /** 1 = a imagem exatamente cobrindo o quadro. Acima disso, aproxima. */
  zoom: number;
  /** Canto superior esquerdo da imagem desenhada, em pixels do quadro. */
  offset: Offset;
};

export const INITIAL_CROP: CropState = { zoom: 1, offset: { x: 0, y: 0 } };

/** Os limites de zoom. Abaixo de 1 sobraria buraco dentro do quadro. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;

export type NaturalSize = { width: number; height: number };

/**
 * A escala que faz a imagem COBRIR o quadro (nunca caber dentro dele).
 *
 * `max` e não `min`: com `min` a imagem caberia inteira e sobrariam duas
 * tarjas vazias nas laterais — e tarja vazia dentro de uma foto de prato lê
 * como imagem quebrada, não como enquadramento.
 */
export function coverScale(natural: NaturalSize, frame: number): number {
  if (natural.width <= 0 || natural.height <= 0) return 1;
  return Math.max(frame / natural.width, frame / natural.height);
}

/** O tamanho com que a imagem é desenhada no quadro, já com o zoom. */
export function drawnSize(natural: NaturalSize, frame: number, zoom: number): NaturalSize {
  const scale = coverScale(natural, frame) * zoom;
  return { width: natural.width * scale, height: natural.height * scale };
}

/**
 * Prende o deslocamento para que o quadro NUNCA mostre vazio.
 *
 * Sem isto, arrastar até o fim deixaria uma faixa transparente entrando no
 * recorte — e ela vira faixa branca (ou preta) no cardápio do cliente, num
 * lugar onde ninguém volta para conferir.
 */
export function clampOffset(
  offset: Offset,
  natural: NaturalSize,
  frame: number,
  zoom: number,
): Offset {
  const drawn = drawnSize(natural, frame, zoom);
  // A imagem cobre o quadro, então o canto pode ir de (frame - drawn) até 0.
  const minX = Math.min(0, frame - drawn.width);
  const minY = Math.min(0, frame - drawn.height);
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  };
}

/**
 * Centraliza a imagem no quadro — o estado em que todo recorte começa.
 *
 * O padrão é o centro porque é onde o assunto da foto quase sempre está; o
 * lojista corrige arrastando quando não estiver.
 */
export function centeredOffset(natural: NaturalSize, frame: number, zoom: number): Offset {
  const drawn = drawnSize(natural, frame, zoom);
  return clampOffset(
    { x: (frame - drawn.width) / 2, y: (frame - drawn.height) / 2 },
    natural,
    frame,
    zoom,
  );
}

export type SourceRect = { sx: number; sy: number; size: number };

/**
 * O retângulo da imagem ORIGINAL que o quadro está mostrando.
 *
 * É o que o canvas precisa: em vez de desenhar a imagem inteira e depois
 * cortar, ele lê direto o pedaço certo em resolução plena. Assim o resultado
 * não perde definição por passar por um desenho do tamanho da tela — o quadro
 * na tela tem uns 260px, e a saída tem 1080.
 */
export function sourceRectFor(natural: NaturalSize, frame: number, crop: CropState): SourceRect {
  const scale = coverScale(natural, frame) * crop.zoom;
  if (scale <= 0) return { sx: 0, sy: 0, size: 0 };

  const offset = clampOffset(crop.offset, natural, frame, crop.zoom);
  return {
    // O canto do quadro, convertido de pixels de tela para pixels da imagem.
    sx: -offset.x / scale,
    sy: -offset.y / scale,
    size: frame / scale,
  };
}

/** Mantém o zoom dentro da faixa e com o passo do stepper. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));
}

/**
 * O nome do arquivo que sobe.
 *
 * O backend renomeia tudo (`{product.id}-{token}.{ext}`) e ignora o que
 * mandamos, mas um multipart sem `filename` é recusado por alguns proxies —
 * e o nome aparece no log de quem for depurar o upload.
 */
export function uploadFileName(): string {
  return 'foto.webp';
}

export type PreparedImage = { blob: Blob; width: number; height: number };

/**
 * Desenha o recorte e devolve o WebP pronto para subir.
 *
 * Fica isolada do resto de propósito: é a única parte que precisa de canvas, e
 * é por isso que a geometria acima é pura.
 */
export async function renderCrop(
  image: CanvasImageSource & NaturalSize,
  frame: number,
  crop: CropState,
): Promise<PreparedImage> {
  const rect = sourceRectFor({ width: image.width, height: image.height }, frame, crop);

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_EDGE;
  canvas.height = Math.round(OUTPUT_EDGE / ASPECT);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');

  // A suavização alta importa porque estamos SEMPRE reduzindo: sem ela, uma
  // foto de 4000px reduzida a 1080 fica com serrilhado nas bordas do prato.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.size,
    rect.size,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY);
  });

  if (!blob) throw new Error('Não foi possível preparar a imagem neste navegador.');
  return { blob, width: canvas.width, height: canvas.height };
}

/**
 * Diz por que o arquivo não serve, ou `null` quando serve.
 *
 * Roda ANTES de qualquer leitura pesada: recusar um vídeo de 40 MB pelo tipo
 * custa nada, e tentar decodificá-lo trava a aba.
 *
 * O limite de tamanho conferido aqui é o do arquivo ESCOLHIDO, não o do que
 * sobe: o que sobe é o WebP recodificado, quase sempre uma fração disto. Um
 * arquivo acima do limite ainda assim é recusado na escolha porque decodificar
 * uma imagem gigante é o que faz a aba engasgar — e porque o lojista precisa
 * saber que aquela foto específica não serve.
 */
export function rejectionReasonFor(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number])) {
    return 'Formato não aceito. Envie uma foto JPEG, PNG ou WebP.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Foto muito grande. O limite é 3 MB — tire uma foto menor ou reduza antes de enviar.';
  }
  return null;
}
