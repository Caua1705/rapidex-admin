/**
 * Copiar texto para a área de transferência, nos dois caminhos.
 *
 * `navigator.clipboard` exige contexto seguro e permissão; num painel aberto
 * por IP na rede da loja (`http://192.168.0.x`) ele simplesmente não existe.
 * Sem o segundo caminho, o botão "Copiar" seria um botão que não faz nada —
 * exatamente onde ele mais importa, que é no balcão.
 *
 * O caminho velho (`execCommand`) é obsoleto DE PROPÓSITO: ele é o que funciona
 * onde o novo não existe.
 *
 * Mora no `ds/` e não dentro de um componente porque tem dois donos: a senha
 * temporária (`OneTimeSecret`) e o número do relato de erro
 * (`erro/ErroDaTela.tsx`). Duas implementações de área de transferência é como
 * um dos dois botões deixa de funcionar por IP sem ninguém notar.
 *
 * Devolve `false` quando os dois caminhos falharam — e quem chama PRECISA
 * olhar: dizer "Copiado" sem ter copiado é pior que não ter o botão.
 */
export async function copiarTexto(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return copiarPeloDocumento(value);
  }
}

/**
 * A cópia onde `navigator.clipboard` não existe.
 *
 * O `<textarea>` fora da tela é o truque de sempre, e ele precisa estar no
 * documento e selecionado para o `execCommand` alcançá-lo. `readOnly` evita o
 * teclado virtual aparecer no telefone durante o instante em que ele existe.
 */
function copiarPeloDocumento(value: string): boolean {
  const area = document.createElement('textarea');
  area.value = value;
  area.readOnly = true;
  area.setAttribute('aria-hidden', 'true');
  /* Fora do alcance do olho e do dedo, sem sair da tela: um deslocamento em px
     seria valor solto (a régua de aderência barra), e um elemento colocado
     acima do topo faz o `select()` rolar a página em alguns navegadores. */
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
