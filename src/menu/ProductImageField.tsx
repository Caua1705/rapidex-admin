import { useCallback, useEffect, useRef, useState } from 'react';

import { messageFromUnknownError } from '../api/errors';
import { uploadProductImage } from '../api/menu';
import { ImageIcon, MinusIcon, PlusIcon } from '../ds/icons';
import { CAIXAS, imagemNaCaixa } from '../ds/image-url';
import {
  ACCEPTED_MIME,
  INITIAL_CROP,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  centeredOffset,
  clampOffset,
  clampZoom,
  drawnSize,
  rejectionReasonFor,
  renderCrop,
  uploadFileName,
  type CropState,
  type NaturalSize,
} from './product-image';
import './ProductImageField.css';

/** O lado do quadro de recorte na tela. A saída é sempre 1080 (ver o módulo). */
const FRAME = 260;

type Escolhida = { url: string; image: HTMLImageElement; natural: NaturalSize };

/**
 * A foto do produto: escolher, recortar e enviar.
 *
 * ONDE ELA VIVE: dentro do "Editar item", junto do resto do produto. Foto é
 * atributo do item como preço e categoria são; uma tela separada faria o
 * lojista salvar duas vezes para cadastrar uma coisa só.
 *
 * O ENVIO SÓ EXISTE COM ID: `POST /admin/products/{id}/image` precisa dele, e um
 * item que ainda não foi criado não tem. No "Novo item", então, o campo não
 * oferece o escolhedor de arquivo — que responderia 404 —, e sim um botão que
 * REGISTRA A INTENÇÃO: quem o clica avisa que quer pôr foto, e o diálogo trata
 * de manter-se aberto depois de salvar, já em modo edição, para que o envio
 * aconteça sem recomeçar. Quem não clica salva e fecha, que é o que cadastrar
 * cardápio em série pede.
 *
 * O RECORTE É OBRIGATÓRIO e a proporção é fixa em 1:1. A miniatura da lista é
 * quadrada e a foto do cardápio é maior, mas as duas saem do mesmo objeto no
 * bucket. Sem recorte, uma foto vertical de celular entra no slot quadrado
 * cortada onde calhar — quase sempre no prato.
 */
export function ProductImageField({
  productId,
  currentImageUrl,
  onUploaded,
  wantsPhoto,
  onWantsPhotoChange,
}: {
  /** `null` num item que ainda não foi criado: a rota exige o id. */
  productId: string | null;
  currentImageUrl: string | null | undefined;
  onUploaded: (imageUrl: string) => void;
  /** Só vale com `productId` nulo: o lojista já pediu para pôr foto. */
  wantsPhoto: boolean;
  onWantsPhotoChange: (wants: boolean) => void;
}) {
  const [escolhida, setEscolhida] = useState<Escolhida | null>(null);
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const arrasteRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  // O object URL é um recurso do documento: sem revogar, cada foto trocada
  // deixa a anterior presa na memória da aba, que fica aberta o dia todo.
  useEffect(() => {
    return () => {
      if (escolhida) URL.revokeObjectURL(escolhida.url);
    };
  }, [escolhida]);

  const escolherArquivo = useCallback((file: File) => {
    setErro(null);

    const recusa = rejectionReasonFor(file);
    if (recusa) {
      setErro(recusa);
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const natural = { width: image.naturalWidth, height: image.naturalHeight };
      setEscolhida({ url, image, natural });
      setCrop({ zoom: 1, offset: centeredOffset(natural, FRAME, 1) });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setErro('Não foi possível abrir esta imagem. Tente outra foto.');
    };
    image.src = url;
  }, []);

  function descartar() {
    if (escolhida) URL.revokeObjectURL(escolhida.url);
    setEscolhida(null);
    setCrop(INITIAL_CROP);
    setErro(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function aplicarZoom(delta: number) {
    if (!escolhida) return;
    setCrop((atual) => {
      const zoom = clampZoom(atual.zoom + delta);
      // Reancorar no centro: sem isto, aproximar joga o assunto para fora do
      // quadro e o lojista precisa rearrastar a cada clique no "+".
      return { zoom, offset: clampOffset(atual.offset, escolhida.natural, FRAME, zoom) };
    });
  }

  function aoArrastar(event: React.PointerEvent<HTMLDivElement>) {
    const arraste = arrasteRef.current;
    if (!arraste || arraste.pointerId !== event.pointerId || !escolhida) return;

    const dx = event.clientX - arraste.x;
    const dy = event.clientY - arraste.y;
    arrasteRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };

    setCrop((atual) => ({
      zoom: atual.zoom,
      offset: clampOffset(
        { x: atual.offset.x + dx, y: atual.offset.y + dy },
        escolhida.natural,
        FRAME,
        atual.zoom,
      ),
    }));
  }

  async function enviar() {
    if (!escolhida || !productId) return;

    setEnviando(true);
    setErro(null);
    try {
      const { blob } = await renderCrop(
        Object.assign(escolhida.image, escolhida.natural),
        FRAME,
        crop,
      );
      const enviada = await uploadProductImage(productId, blob, uploadFileName());
      onUploaded(enviada.image_url ?? '');
      descartar();
    } catch (error) {
      setErro(messageFromUnknownError(error));
    } finally {
      setEnviando(false);
    }
  }

  // A MESMA função que a saída usa. Calcular o tamanho da prévia por outra
  // conta aqui é como o que se vê deixa de ser o que sobe.
  const desenhada = escolhida ? drawnSize(escolhida.natural, FRAME, crop.zoom) : null;

  return (
    <section className="form__section">
      <h3 className="form__section-title">Foto do item</h3>

      {productId === null ? (
        /*
          O BOTÃO NÃO ABRE O ESCOLHEDOR DE ARQUIVO: ele diz ao diálogo que esta
          criação termina na foto, e não no fechamento. É uma alternância porque
          desistir precisa ser tão barato quanto pedir — sem ela, um clique por
          engano obriga a salvar, fechar e reabrir o item para sair do caminho
          da foto.
        */
        <div className="foto__intencao">
          <button
            type="button"
            className={`btn btn--sm${wantsPhoto ? ' btn--ghost' : ''}`}
            onClick={() => onWantsPhotoChange(!wantsPhoto)}
            data-testid="product-image-intent"
            aria-pressed={wantsPhoto}
          >
            {wantsPhoto ? 'Não adicionar foto' : 'Adicionar foto'}
          </button>
          <p className="field__hint">
            {wantsPhoto
              ? 'Ao salvar, o item é criado e este diálogo continua aberto para você enviar a foto.'
              : 'A foto é enviada para o item, e o item ainda não existe. Peça-a aqui para não precisar reabrir o cadastro depois de salvar.'}
          </p>
        </div>
      ) : escolhida === null ? (
        <>
          {/*
            O ALVO DE ARRASTAR É O MESMO BOTÃO DE ESCOLHER, não uma área
            separada: duas zonas para a mesma ação é o que faz o lojista
            perguntar qual das duas é a certa.
          */}
          <div
            className={`foto__alvo${arrastandoArquivo ? ' is-arrastando' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setArrastandoArquivo(true);
            }}
            onDragLeave={() => setArrastandoArquivo(false)}
            onDrop={(event) => {
              event.preventDefault();
              setArrastandoArquivo(false);
              const file = event.dataTransfer.files[0];
              if (file) escolherArquivo(file);
            }}
          >
            {currentImageUrl ? (
              /*
                O SELO DA FOTO QUE JÁ ESTÁ NO ITEM — 56px, e por isso ele pede
                112 ao Storage em vez do objeto cru do bucket, que é o que o
                backend devolve em `image_url` (ver `ds/image-url.ts`). Não é o
                lugar de julgar a foto: é o lugar de saber QUAL foto está lá
                antes de trocá-la.
              */
              <img
                className="foto__atual"
                src={imagemNaCaixa(currentImageUrl, CAIXAS.fotoDoProduto)}
                alt=""
                decoding="async"
                data-testid="product-image-current"
              />
            ) : (
              <div className="foto__vazia" aria-hidden="true">
                <ImageIcon size={20} />
              </div>
            )}

            <div className="foto__acao">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => inputRef.current?.click()}
                data-testid="product-image-choose"
              >
                {currentImageUrl ? 'Trocar foto' : 'Escolher foto'}
              </button>
              <p className="field__hint">
                {arrastandoArquivo
                  ? 'Solte a foto aqui.'
                  : 'Ou arraste uma foto para cá. JPEG, PNG ou WebP, até 3 MB.'}
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={ACCEPTED_MIME.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) escolherArquivo(file);
            }}
            data-testid="product-image-input"
          />
        </>
      ) : (
        <div className="foto__editor">
          {/*
            O quadro mostra EXATAMENTE o que vai subir. Ele não é uma prévia
            aproximada: a mesma geometria que desenha aqui calcula o retângulo
            que o canvas lê da imagem em resolução plena.
          */}
          <div
            className="foto__quadro"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={(event) => {
              arrasteRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={aoArrastar}
            onPointerUp={(event) => {
              arrasteRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            data-testid="product-image-frame"
          >
            <img
              className="foto__previa"
              src={escolhida.url}
              alt=""
              draggable={false}
              style={{
                width: desenhada?.width,
                height: desenhada?.height,
                transform: `translate(${crop.offset.x}px, ${crop.offset.y}px)`,
              }}
            />
          </div>

          <div className="foto__controles">
            <p className="field__hint">Arraste a foto para escolher o pedaço que aparece.</p>

            {/*
              Aproximar é um stepper, como o +5/+10 do preparo — não um
              controle de faixa nativo, que o sistema não desenha.
            */}
            <div className="foto__zoom">
              <span className="field__label">Aproximar</span>
              <div className="foto__zoom-botoes">
                <button
                  type="button"
                  className="btn btn--sm icon-btn"
                  aria-label="Afastar"
                  disabled={crop.zoom <= MIN_ZOOM}
                  onClick={() => aplicarZoom(-ZOOM_STEP)}
                >
                  <MinusIcon size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn--sm icon-btn"
                  aria-label="Aproximar"
                  disabled={crop.zoom >= MAX_ZOOM}
                  onClick={() => aplicarZoom(ZOOM_STEP)}
                >
                  <PlusIcon size={14} />
                </button>
              </div>
            </div>

            <div className="foto__botoes">
              <button type="button" className="btn btn--sm" onClick={descartar} disabled={enviando}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={() => void enviar()}
                disabled={enviando}
                data-testid="product-image-send"
              >
                {enviando ? 'Enviando…' : 'Enviar foto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {erro ? (
        <p className="alert alert--error" role="alert" data-testid="product-image-error">
          {erro}
        </p>
      ) : null}

      {/*
        A FOTO ANTERIOR FICA NO BUCKET, e o lojista precisa saber que trocar não
        apaga. É decisão do backend: o objeto novo nasce com sufixo aleatório e
        o antigo permanece, porque apagar na hora deixaria o cardápio sem
        imagem enquanto o CDN ainda serve a URL velha.
      */}
      {productId !== null && currentImageUrl ? (
        <p className="field__hint">
          Trocar a foto não apaga a anterior do armazenamento — ela deixa de ser usada, mas continua
          lá.
        </p>
      ) : null}
    </section>
  );
}
