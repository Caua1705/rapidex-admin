/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /**
   * O domínio do app do CLIENTE — de onde sai o link do entregador.
   *
   * SEM PADRÃO, e o `?` aqui é a decisão inteira: faltando a variável, o painel
   * não oferece o botão de gerar acesso, porque a alternativa seria gerar um
   * link para um domínio errado — e o par link+código sai uma vez só. Ver
   * `couriers/courier-access.ts`.
   */
  readonly VITE_COURIER_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
