# Salvar Fornecedor

Catálogo estático e instalável para organizar produtos e fornecedores de quem vende pela Amazon no modelo FBM.

**Site:** [fornecedorsave.netlify.app](https://fornecedorsave.netlify.app/)

## O que faz

- Salva links e fichas de produtos com nome, fornecedor, custo, preço de venda, foto e notas.
- Tenta buscar nome, preço e imagem a partir do link. Dependendo do resultado, o produto pode ser salvo automaticamente ao colar o link ou aparecer para revisão; confira os dados no catálogo.
- Organiza produtos em listas, com cores predefinidas ou personalizadas, e permite pesquisar, filtrar, ordenar e fixar itens.
- Exibe lucro líquido estimado pela conta **preço de venda − custo do fornecedor**. A estimativa **não inclui** comissão, taxas ou impostos da Amazon, frete FBM, embalagem, anúncios nem outros custos.
- Exporta e restaura backups JSON. A restauração adiciona dados que ainda não existem, sem substituir os produtos já salvos.
- Pode ser instalado como PWA e abre o catálogo salvo offline; buscas externas e imagens que não estejam em cache precisam de internet.

O projeto não integra com a conta Seller Central e não acompanha pedidos ou estoque vendido: é um catálogo de pesquisa e organização de fornecedores.

## Como funciona e onde ficam os dados

O site é feito em HTML, CSS e JavaScript, sem servidor de aplicação, banco de dados, login ou processo de build. Produtos, listas e preferências ficam no armazenamento local do navegador neste aparelho. O app mantém uma cópia local de recuperação, mas isso não é sincronização em nuvem. Baixe backups regularmente; limpar os dados do navegador ou trocar de aparelho pode remover o catálogo local.

O app tenta buscar metadados do produto usando serviços públicos de proxy e metadados. A URL do produto é enviada a esses serviços durante a busca; eles podem falhar ou mudar. O cadastro manual continua disponível se a busca não funcionar. Não informe dados secretos nesses links.

## Executar localmente

Não é necessário instalar dependências. Na pasta do projeto, inicie um servidor estático, por exemplo:

```bash
python -m http.server 8000
```

Abra [http://localhost:8000](http://localhost:8000). Usar um servidor local também permite testar o service worker; abrir `index.html` diretamente como arquivo (`file://`) não é recomendado.

## Publicar na Netlify

O repositório já inclui `netlify.toml`. Para publicar pelo GitHub:

1. No Netlify, escolha **Add new site → Import an existing project** e conecte sua conta do GitHub.
2. Selecione `tiozinhow/salvar-fornecedor` e a branch `main`.
3. Configure o diretório base como a raiz do repositório, deixe o **Build command** vazio e use `.` como **Publish directory**.
4. Clique em **Deploy**. Não há etapa de build; o Netlify publica os arquivos estáticos diretamente.

Para usar o endereço informado, conecte o repositório ao site Netlify existente ou defina o nome do site como `fornecedorsave`, se estiver disponível na sua conta. Novos commits na branch conectada serão publicados automaticamente.

## Estrutura

- `index.html` — telas e estrutura do app.
- `styles.css` — aparência responsiva.
- `app.js` — catálogo, listas, cálculos, armazenamento e backups.
- `sw.js` — cache da aplicação para uso offline.
- `manifest.webmanifest` e `icons/` — instalação como PWA.
- `netlify.toml` — configuração de publicação estática e atualização do service worker.

## Contribuir

Sugestões e correções podem ser enviadas por issues ou pull requests. Evite incluir dados pessoais ou backups reais em commits.

## Licença

Distribuído sob a licença MIT; veja [`LICENSE`](LICENSE).
